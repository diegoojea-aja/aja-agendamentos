# AJA Agendamentos

Sistema interno de agendamento de reuniões closer × lead da AJA Educação.
Roteamento balanceado por carga + qualificação, integração Google Calendar
+ Slack + Zoho CRM.

Domínio: `agendamentos.ajaeducacao.com.br`

Stack: Next.js 16 (App Router) · Supabase · Tailwind v4 · TypeScript

---

## Setup local

```bash
# 1. Clone
git clone https://github.com/diegoojea-aja/aja-agendamentos.git
cd aja-agendamentos

# 2. Install
npm install

# 3. Configura .env.local (ver env vars abaixo)
cp .env.example .env.local

# 4. Aplica migration
npx tsx scripts/run-migration.ts 001

# 5. (Opcional) Migra dados do forms-aja antigo
FORMS_AJA_SUPABASE_URL=https://vjnpxrzyrmwotieymefz.supabase.co \
FORMS_AJA_SERVICE_ROLE_KEY=... \
npx tsx scripts/migrate-from-forms-aja.ts

# 6. Dev server
npm run dev
```

## Env vars necessárias

| Var | Descrição | Onde achar |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do Supabase aja-agendamentos | Dashboard → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key | Dashboard → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role | Dashboard → Settings → API |
| `SUPABASE_DB_URL` | Connection string Postgres | Dashboard → Settings → Database |
| `SLACK_BOT_TOKEN` | Token do `infra_bot` (compartilhado com forms-aja) | já existe no forms-aja |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | Base64 do JSON da Service Account | já existe no forms-aja |
| `CRON_SECRET` | Secret pra cron jobs Vercel | gerar uma string aleatória |

## Estrutura

```
src/app/
├── (internal)/          ← rotas autenticadas com AppShell
│   ├── agendamentos/    ← hub admin + meus + novo + calendario + closers + config
│   └── admin/           ← usuarios + configuracoes
├── agendar/[slug]/      ← URL pública (link Zoho)
├── login/
└── page.tsx             ← redirect role-aware

src/api/
├── schedule/            ← book, slots, closers, admin
├── sdr/, closer/        ← dashboards role-aware
├── cron/                ← cron diário de pendentes
├── me, users, health
```

## Migrations

Migration consolidada `001_initial_schema.sql` cria todas as tabelas
(`user_profiles`, `closers`, `bookings`) com schema final.

Aplicar:
```bash
npx tsx scripts/run-migration.ts 001
```

## Auth

Replicado do forms-aja: cada app tem sua própria tabela `user_profiles`
no Supabase próprio. Sincronização manual via script
`migrate-from-forms-aja.ts` (idempotente).

Roles: `admin`, `sdr`, `comercial`, `cs`, `eventos`, `closer`.

## Deploy

Vercel project apontando pra branch `main`. Env vars no dashboard Vercel.

DNS: `agendamentos.ajaeducacao.com.br` → Vercel.

## Cron (Vercel Pro)

Definido em `vercel.json`:
```json
{
  "crons": [
    { "path": "/api/cron/check-pending-bookings", "schedule": "0 11 * * *" }
  ]
}
```
