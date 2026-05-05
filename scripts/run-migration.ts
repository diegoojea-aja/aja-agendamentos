/**
 * Runner de migração para forms-aja.
 *
 * Uso:
 *   npx tsx scripts/run-migration.ts 007
 *   npx tsx scripts/run-migration.ts 007_booking_lead_fields
 *   npx tsx scripts/run-migration.ts supabase/migrations/007_booking_lead_fields.sql
 *
 * Requer no .env.local:
 *   SUPABASE_DB_URL=postgres://...
 *
 * Segurança: valida que o host/ref bate com forms-aja antes de executar.
 */

import { Client } from 'pg'
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import { readFileSync, readdirSync } from 'fs'

dotenv.config({ path: resolve(__dirname, '../.env.local') })

// project_ref extraído do NEXT_PUBLIC_SUPABASE_URL (evita hardcoding pra
// poder trocar de Supabase sem editar script).
const EXPECTED_PROJECT_REF =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || ''
const MIGRATIONS_DIR = resolve(__dirname, '../supabase/migrations')

function resolveMigrationFile(arg: string): string {
  // caminho absoluto ou relativo já existente
  try {
    readFileSync(arg)
    return arg
  } catch { /* segue */ }

  try {
    const asRelative = resolve(process.cwd(), arg)
    readFileSync(asRelative)
    return asRelative
  } catch { /* segue */ }

  // buscar por prefixo numérico (ex: "007" → "007_*.sql")
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'))
  const match = files.find((f) => f.startsWith(arg) || f === `${arg}.sql`)
  if (match) return resolve(MIGRATIONS_DIR, match)

  throw new Error(
    `Migration não encontrada: "${arg}". Disponíveis:\n  ${files.join('\n  ')}`
  )
}

function validateTarget(dbUrl: string): void {
  // Valida que a connection string aponta pro forms-aja.
  // Aceita: db.{ref}.supabase.co OU postgres.{ref}@... (pooler)
  const hasRef = dbUrl.includes(EXPECTED_PROJECT_REF)
  if (!hasRef) {
    console.error('❌ ABORTANDO: SUPABASE_DB_URL não aponta pro forms-aja.')
    console.error(`   Esperado project_ref: ${EXPECTED_PROJECT_REF}`)
    console.error(`   URL fornecida (mascarada): ${dbUrl.replace(/:[^:@]+@/, ':***@')}`)
    process.exit(1)
  }
}

async function main() {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Uso: npx tsx scripts/run-migration.ts <número|arquivo>')
    console.error('Ex:  npx tsx scripts/run-migration.ts 007')
    process.exit(1)
  }

  const dbUrl = process.env.SUPABASE_DB_URL
  if (!dbUrl) {
    console.error('❌ SUPABASE_DB_URL não configurada no .env.local')
    console.error('   Formato: postgres://postgres.<ref>:<senha>@<pooler>:6543/postgres')
    process.exit(1)
  }

  validateTarget(dbUrl)

  const file = resolveMigrationFile(arg)
  const sql = readFileSync(file, 'utf-8')

  console.log(`📄 Migration: ${file.replace(process.cwd() + '/', '')}`)
  console.log(`🎯 Target:    aja-agendamentos (${EXPECTED_PROJECT_REF})`)
  console.log('')
  console.log(sql.split('\n').slice(0, 10).map((l) => `   ${l}`).join('\n'))
  if (sql.split('\n').length > 10) console.log('   ...')
  console.log('')

  // Supabase direct connection é IPv6-only. pg.Client default não usa IPv6
  // em macOS sem ajuda. Resolve manualmente e passa o IP literal.
  const dns = await import('dns')
  const url = new URL(dbUrl)
  let host = url.hostname
  try {
    const v6 = await dns.promises.resolve6(host)
    if (v6.length > 0) {
      host = v6[0]
      console.log(`🌐 IPv6 resolvido: ${host}`)
    }
  } catch {
    /* fallback pro hostname original */
  }

  const client = new Client({
    host,
    port: Number(url.port) || 5432,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    ssl: { rejectUnauthorized: false },
  })

  try {
    await client.connect()
    console.log('🔌 Conectado')
    await client.query('BEGIN')
    await client.query(sql)
    await client.query('COMMIT')
    console.log('✅ Migration aplicada')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error('❌ Erro:', err instanceof Error ? err.message : err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

main()
