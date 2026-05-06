# AJA Agendamentos — Como funciona

## Visão geral

```
┌──────────┐     ┌─────────────────┐     ┌──────────────────┐
│   SDR    │────▶│ AJA Agendamentos│────▶│ Google Calendar  │
│ (logado) │     │   (Next.js)     │     │  (Service Acct)  │
└──────────┘     └─────────────────┘     └──────────────────┘
                         │   │
                         │   └────────────▶ Slack (infra_bot)
                         │                  notificações
                         │
                         ▼
                  ┌──────────────┐
                  │   Supabase   │
                  │ (bookings,   │
                  │  closers,    │
                  │  users)      │
                  └──────────────┘
```

---

## Fluxo de criação de booking (auto-routing)

### 1. SDR abre `/agendamentos/novo`
Pode vir do Zoho com URL params (`?nome=X&telefone=Y&zoho_id=...&produto=...&score=...`) ou preencher manual.

### 2. SDR informa qualificação
- **Bucket** (score): `Muito Qualificado`, `Qualificado`, `Neutro`, `Semi Desqualificado`
- **Produto** (opcional): segmenta closers que aceitam aquele produto

### 3. Sistema seleciona closer
Algoritmo em `src/lib/routing.ts`:

1. Filtra `closers` ativas onde:
   - `accepts_scores` está vazio OU contém o bucket informado
   - `accepts_products` está vazio OU contém o produto informado
2. Calcula score primário: `count_no_bucket / weight`
3. Tiebreaker 1: `count_total / weight`
4. Tiebreaker 2: `last_assigned_at` mais antigo

A closer escolhida é exibida no UI (SDR pode confirmar ou cancelar).

### 4. SDR escolhe data + horário
Frontend chama `GET /api/schedule/auto/slots?date=YYYY-MM-DD&duration=30` que:
1. Carrega `working_hours` da closer escolhida
2. Faz Google Calendar `freeBusy` impersonando o email da closer
3. Subtrai eventos + buffer (`buffer_minutes`)
4. Retorna array de horários livres

### 5. Confirmação cria booking
`POST /api/schedule/auto/book` com payload (closer_id, date, time, duration, lead, sdr_note):
1. **Re-verifica disponibilidade** (anti race condition)
2. Cria evento no Google Calendar da closer (com lead como invitee se tiver email)
3. Insere `bookings` row com status=`confirmed`, `google_event_id`, `google_meet_link`
4. Atualiza `closers.last_assigned_at`
5. Notifica Slack canal `#aja-comercial-agendamentos` (configurável)

---

## Fluxo de booking via closer específica (Fase 2 — pendente)

SDR escolhe closer manualmente (pulando routing). Booking entra como `pending_approval`:

1. Cria booking com `status='pending_approval'`, sem evento Calendar
2. Slot é segurado (próximas requests pra mesmo horário rejeitam)
3. Slack notifica admin com link `/agendamentos/aprovar/[id]`
4. Admin aprova → cria evento Calendar, status=confirmed
5. Admin rejeita → deleta booking, slot liberado

Detalhes em `PRD.md > Workflow de aprovação`.

---

## Mudança de status (closer pós-call)

Closer abre `/agendamentos/meus` e vê seus bookings do dia. Cada booking tem botões:
- **Compareceu** → status=`finalizado`
- **Não compareceu** → status=`no_show`
- **Reagendar** → cria novo booking com `rescheduled_from_id` apontando pro original
- **Cancelar** → status=`cancelled`, deleta evento Calendar

`PATCH /api/schedule/bookings/[id]/status` faz a transição com validação (closer logada precisa ser dona, ou admin).

---

## Cron diário

`vercel.json` configura `/api/cron/check-pending-bookings` em `0 11 * * *` (8h BRT, 11h UTC).

Verifica bookings com status=`confirmed` cuja `time_end` já passou e SEM status pós-call. Notifica admin via Slack pra cobrar a closer.

Autenticação: header `Authorization: Bearer ${CRON_SECRET}` (Vercel injeta automaticamente).

---

## Google Calendar — Service Account

### Setup (manual, feito uma vez)
1. Google Cloud Console: projeto `superb-ship-494115-q5`, Calendar API habilitada
2. Service Account com chave JSON
3. Workspace Admin → Security → API Controls → Domain-wide delegation → adicionar SA com scopes:
   - `https://www.googleapis.com/auth/calendar.freebusy`
   - `https://www.googleapis.com/auth/calendar.events`
4. JSON da chave → base64 → env var `GOOGLE_SERVICE_ACCOUNT_KEY`

### Em runtime
`src/lib/google-calendar.ts` cria um JWT client com `subject = closerEmail` em cada chamada — a SA "vira" a closer e age em nome dela. Sem OAuth individual.

**Importante**: a mesma SA é usada pelo forms-aja (compatibilidade — historicamente o scheduling vivia lá). Não rotacionar uma sem rotacionar a outra.

---

## Auth — replicada com forms-aja

Cada projeto tem seu Supabase próprio. `user_profiles` existe em ambos com mesma estrutura. ID do user é o mesmo (= `auth.users.id`).

**Sync**: `scripts/migrate-from-forms-aja.ts` faz upsert por id. Idempotente — pode rodar quantas vezes quiser sem duplicar.

**Login**: usuário precisa existir em `auth.users` E em `user_profiles` no Supabase apropriado. Quando criamos um user novo (ex: `scripts/create-diego-user.ts`), o id do auth precisa BATER com o id do user_profile pra `/api/me` funcionar.

**Cookie**: middleware varre `sb-*-auth-token` (independe de project_ref). AppShell faz logout limpando todos os cookies que casam.

---

## Slack — `infra_bot`

Mesmo bot do forms-aja. `SLACK_BOT_TOKEN` é compartilhado.

Notificações implementadas:
- Booking criado (canal `#aja-comercial-agendamentos`)
- Booking pendente sem status pós-call (cron diário, DM admin)
- Aprovação requerida (Fase 2 — pendente)

Convidar bot em canal novo: `/invite @infra_bot` no canal.

---

## Segurança

### Middleware (`src/middleware.ts`)
- Protege: `/admin`, `/agendamentos`, `/api/{me,users,sdr,closer,schedule}/*`
- Público: `/api/cron` (auth via `CRON_SECRET` interno), `/api/health`
- Localhost: injeta `x-user-id=localhost-dev-user` (admin local pra dev)

### Validação de status transitions
`/api/schedule/bookings/[id]/status` valida:
- Closer logada é dona OU admin
- Estado de origem permite a transição (ex: não dá pra "cancelar" um já cancelado)

### Cron secret
`/api/cron/check-pending-bookings` rejeita se `Authorization: Bearer` não bate com `process.env.CRON_SECRET`.

---

## Infraestrutura

| Componente | Tecnologia | Hospedagem |
|------------|------------|------------|
| AJA Agendamentos (frontend + API) | Next.js 16, React 19, Tailwind v4 | Vercel |
| Supabase (user_profiles, closers, bookings) | PostgreSQL | Supabase Cloud (`kgsinixtyljujnrmkjcr`) |
| Google Calendar | Service Account `superb-ship-494115-q5` | Google Workspace |
| Slack | `infra_bot` | Workspace AJA |
| Cron | Vercel Cron (`vercel.json`) | Vercel |
| Design System | Instrument Sans, dark mode, glassmorphic | — |

### Env vars

**Vercel (production):**
```
NEXT_PUBLIC_SUPABASE_URL          → Supabase aja-agendamentos
NEXT_PUBLIC_SUPABASE_ANON_KEY     → Supabase aja-agendamentos (público)
SUPABASE_SERVICE_ROLE_KEY         → Supabase aja-agendamentos (server)
SLACK_BOT_TOKEN                   → Bot infra_bot (mesmo do forms-aja)
GOOGLE_SERVICE_ACCOUNT_KEY        → SA superb-ship-494115-q5 (base64 do JSON)
CRON_SECRET                       → assinatura do Vercel Cron
HUB_CS_INTAKE_URL                 → opcional, usado em /api/health
```

**Local (`.env.local` — não vão pro Vercel):**
```
SUPABASE_DB_URL                   → connection string Postgres (run-migration)
FORMS_AJA_SUPABASE_URL            → fonte do migrate-from-forms-aja
FORMS_AJA_SERVICE_ROLE_KEY        → service role do forms-aja Supabase
```

---

## Migrations

Aplicar via `npx tsx scripts/run-migration.ts <numero>`. Script valida que `SUPABASE_DB_URL` aponta pro project_ref que está em `NEXT_PUBLIC_SUPABASE_URL` (proteção contra rodar no Supabase errado).

Lista atual em `supabase/migrations/`. Algumas migrations herdadas do forms-aja (numeração começando em 001) ainda estão no banco — tabelas órfãs (forms, responses, etc) podem ser dropadas no futuro com migration de cleanup.

---

## Scripts úteis

- `create-admins.ts` — cria admins iniciais
- `create-diego-user.ts` / `create-fellipe.ts` — cria user específico em auth + atualiza senha
- `list-users.ts` — lista auth.users + user_profiles (debug de sync)
- `migrate-from-forms-aja.ts` — sync de user_profiles + closers + bookings do forms-aja
- `run-migration.ts` — aplica SQL migration validando project_ref
- `seed-closers.ts` — popula closers iniciais

---

## Verificação rápida

1. `npm run dev` → `/login` → autenticar
2. Como admin: `/agendamentos` → ver hub; `/agendamentos/closers` → CRUD; `/agendamentos/configuracoes` → regras
3. Como SDR: `/agendamentos/novo` → fluxo auto-routing; criar booking → conferir no Google Calendar da closer
4. Como closer: `/agendamentos/meus` → ver bookings → marcar status
5. `/api/health` → 200 com `supabase: ok` e `google_calendar: ok`
