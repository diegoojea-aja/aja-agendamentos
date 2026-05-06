# PRD — AJA Agendamentos

## Contexto

Sistema interno de agendamento de reuniões closer × lead da AJA Educação. SDR distribui o lead, sistema atribui pra closer apropriada (auto-routing por bucket de qualificação e peso) ou SDR escolhe closer específica (com aprovação admin — fase 2). Integração Google Calendar (impersonation), Slack (notificações) e Zoho CRM (lead lookup).

Domínio: `agendamentos.ajaeducacao.com.br`

Origem: extraído do repo `aja-forms` em maio/2026 pra ter ciclo de release independente. Auth replicada (cada Supabase tem o seu `user_profiles`, sync via script).

---

## Decisões Técnicas

| Item | Escolha |
|------|---------|
| Repo | `diegoojea-aja/aja-agendamentos` |
| Stack | Next.js 16 (App Router) · React 19 · Tailwind v4 · TypeScript |
| Database | Supabase (Postgres + Auth) — project `kgsinixtyljujnrmkjcr` |
| Deploy | Vercel |
| Domínio | `agendamentos.ajaeducacao.com.br` |
| Calendar | Google Calendar API + Service Account com Domain-Wide Delegation |
| Slack bot | `infra_bot` (compartilhado com forms-aja) |
| Cron | Vercel Cron (`vercel.json`) — verificação diária de pendências |

---

## Roles

- **admin** — vê tudo, gerencia closers e regras de roteamento
- **sdr** — agenda novas reuniões; vê suas próprias agendadas
- **closer** — vê suas reuniões; marca status pós-call
- **comercial / cs / eventos** — coexistem por compat com `user_profiles` (sync com forms-aja), mas não são usuários operacionais aqui

---

## Funcionalidades

### 1. Hub `/agendamentos` (admin)
- Visão geral: distribuição entre closers, agendamentos do mês, pendências
- Lista cronológica de bookings com filtros (status, closer, SDR)
- Modal de mudança de status (no-show, finalizado, reagendado, cancelado)

### 2. Meus agendamentos `/agendamentos/meus` (SDR/closer)
- SDR: bookings que ele criou
- Closer: bookings dela
- Cards com lead info + botões de status (closer)

### 3. Novo `/agendamentos/novo` (SDR/admin)
- Fluxo automático: SDR informa lead (vem do Zoho via URL params ou manual), bucket de qualificação, produto
- Sistema seleciona closer via algoritmo de roteamento (ver Arquitetura)
- Mostra slots disponíveis (Google Calendar live)
- Confirmação cria evento no Calendar da closer + Slack notification

### 4. Calendário `/agendamentos/calendario` (admin)
- Visão semanal/mensal agregada de todas as closers

### 5. Closers `/agendamentos/closers` (admin)
- CRUD de closers (nome, slug, email, photo, duration_options, working_hours, buffer)
- Vincular a um `user_profile` com role=closer
- Ativar/desativar

### 6. Roteamento `/agendamentos/configuracoes` (admin)
- Configurar peso (`weight`) de cada closer
- Configurar quais buckets cada uma aceita (`accepts_scores`)
- Configurar quais produtos cada uma aceita (`accepts_products`)
- Visualizar distribuição em tempo real (total + breakdown por bucket)

### 7. Admin `/admin/usuarios`
- CRUD de user_profiles
- Sincronização manual via `scripts/migrate-from-forms-aja.ts`

---

## Algoritmo de Roteamento

Quando SDR agenda no fluxo automático, sistema escolhe a closer da seguinte forma:

1. **Filtra elegíveis**: `active = true` AND `bucket ∈ accepts_scores` AND `produto ∈ accepts_products` (ou listas vazias = aceita tudo)
2. **Score primário**: `count_no_bucket / weight` (menor é melhor — privilegia quem tem menos no bucket vs sua capacidade)
3. **Tiebreaker 1**: `count_total / weight` (capacidade geral)
4. **Tiebreaker 2**: `last_assigned_at` mais antigo (round-robin justo)

Resultado: distribuição balanceada por carga **e** qualificação. Closer com weight=2 recebe ~2× mais que weight=1. Closers desabilitadas pra um bucket não recebem leads daquele bucket.

---

## Workflow de aprovação (Fase 2 — pendente)

SDR pode escolher closer específica em vez de auto-routing. Esse fluxo:

- Cria booking com `status = 'pending_approval'`
- Slot é segurado (impede outro agendamento no mesmo horário)
- Calendar event NÃO é criado ainda
- Notifica admin via Slack com link pra `/agendamentos/aprovar/[id]`
- Admin aprova → status=confirmed, cria evento Calendar
- Admin rejeita → booking deletado, slot liberado

Decisões pendentes (anotadas em `MEMORY.md`):
- Quem aprova: qualquer admin?
- Notificação: Slack DM ou canal?
- Slot durante pending: segurar (proposto) ou liberar?

---

## Estrutura

```
src/
├── app/
│   ├── (internal)/                ← rotas autenticadas com AppShell
│   │   ├── admin/usuarios/        ← gerenciamento de users
│   │   └── agendamentos/
│   │       ├── page.tsx           ← visão geral admin
│   │       ├── meus/              ← agendamentos do user logado
│   │       ├── novo/              ← criar novo (SDR fluxo auto)
│   │       ├── calendario/        ← visão semanal
│   │       ├── closers/           ← CRUD closers
│   │       └── configuracoes/     ← regras de roteamento
│   ├── api/
│   │   ├── schedule/
│   │   │   ├── [slug]/            ← book + slots por closer (interno)
│   │   │   ├── auto/              ← book + slots no fluxo auto
│   │   │   ├── admin/             ← agenda + routing + stats
│   │   │   ├── bookings/[id]/     ← mudar status
│   │   │   └── closers/           ← lista + admin CRUD
│   │   ├── sdr/bookings/          ← bookings do SDR logado
│   │   ├── closer/bookings/       ← bookings da closer logada
│   │   ├── cron/check-pending-bookings/ ← cron diário
│   │   ├── users/                 ← admin users
│   │   ├── me/                    ← profile logado
│   │   └── health/                ← smoke test
│   └── login/
├── components/
│   ├── AppShell.tsx               ← sidebar role-aware (Principal/Gestão/Admin)
│   ├── admin/BookingStatusModal.tsx
│   └── ui/                        ← Dropdown, DarkShell, etc
├── lib/
│   ├── google-calendar.ts         ← Service Account + impersonation
│   ├── routing.ts                 ← algoritmo bucket+weight
│   ├── integrations/slack.ts
│   ├── auth-helpers.ts            ← getUserProfile, requireRole
│   ├── supabase.ts / supabase-server.ts
│   ├── api-client.ts              ← authFetch (cliente)
│   ├── rate-limit.ts
│   └── logger.ts
└── middleware.ts                  ← protege /admin, /agendamentos, /api/{me,users,sdr,closer,schedule}/*
```

---

## Schema do banco (resumo)

- `user_profiles` — id (= auth.users.id), email, name, role, active
- `closers` — id, name, slug, email (corporate), photo_url, duration_options, working_hours jsonb, buffer_minutes, weight, accepts_scores text[], accepts_products text[], last_assigned_at, user_id (FK user_profiles, opcional)
- `bookings` — id, closer_id, sdr_user_id, lead_name, lead_email, lead_phone, lead_produto, lead_score (bucket), zoho_id, observations, date, time_start, time_end, duration, status, google_event_id, google_meet_link, sdr_note, rescheduled_from_id, created_at

Migrations versionadas em `supabase/migrations/`. Aplicar via `npx tsx scripts/run-migration.ts <numero>` — valida `project_ref` antes de executar.

---

## Decisões importantes

- **Auth replicada**: forms-aja e aja-agendamentos têm cada um seu Supabase. `user_profiles` é replicada manualmente via `scripts/migrate-from-forms-aja.ts` (idempotente, upsert por id). Usuário criado em um sistema precisa ser sincronizado pro outro pra logar nos dois.
- **Calendar via Service Account**: Domain-Wide Delegation no Workspace AJA permite que a SA `superb-ship-494115-q5` impersone qualquer email `@ajaeducacao.com.br`. Não usa OAuth individual. Mesma SA do forms-aja (compartilhada).
- **Slack bot compartilhado**: `infra_bot` (`SLACK_BOT_TOKEN`) é o mesmo do forms-aja. Convidar manualmente em qualquer canal novo via `/invite @infra_bot`.
- **Cookie de auth**: cookie name é `sb-{project_ref}-auth-token`. Middleware varre `sb-*-auth-token` (independe de project_ref) pra facilitar troca de Supabase.
- **Localhost bypass**: middleware injeta `x-user-id=localhost-dev-user` em requests de localhost. `auth-helpers.getUserProfile` trata como admin local.

---

## Verificação

1. `npm run dev` (port 3006 sugerido pra evitar conflito com forms-aja em 3000) → `/login`
2. Logar como admin → sidebar mostra Visão geral, Calendário, Closers, Roteamento, Usuários
3. Logar como SDR → sidebar mostra Meus, Novo
4. `/agendamentos/novo` → testar fluxo auto: lead vem com bucket → sistema escolhe closer → ver slot → confirmar → conferir Calendar event criado
5. `/api/health` → Supabase + Google Calendar (impersonation OK)
