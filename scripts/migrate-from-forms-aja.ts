/**
 * Migra dados de scheduling do Supabase forms-aja pro Supabase
 * aja-agendamentos. Idempotente (upsert por id).
 *
 * Move:
 *   - user_profiles (todos: admins + sdrs + closers usando o sistema)
 *   - closers
 *   - bookings (todos os status; preserva ids pra manter rescheduled_from_id)
 *
 * Uso (após criar Supabase aja-agendamentos e setar SUPABASE_* no .env.local):
 *
 *   FORMS_AJA_SUPABASE_URL=https://vjnpxrzyrmwotieymefz.supabase.co \
 *   FORMS_AJA_SERVICE_ROLE_KEY=... \
 *   npx tsx scripts/migrate-from-forms-aja.ts
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '../.env.local') })

async function run() {
  const sourceUrl = process.env.FORMS_AJA_SUPABASE_URL
  const sourceKey = process.env.FORMS_AJA_SERVICE_ROLE_KEY
  const targetUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const targetKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!sourceUrl || !sourceKey) {
    throw new Error('Setar FORMS_AJA_SUPABASE_URL e FORMS_AJA_SERVICE_ROLE_KEY')
  }
  if (!targetUrl || !targetKey) {
    throw new Error('Setar NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY')
  }
  if (sourceUrl === targetUrl) {
    throw new Error('Source e target apontam pro mesmo Supabase. Aborto.')
  }

  const source = createClient(sourceUrl, sourceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const target = createClient(targetUrl, targetKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  console.log(`📥 Source: ${sourceUrl}`)
  console.log(`📤 Target: ${targetUrl}`)
  console.log('━'.repeat(70))

  // ─── 1. user_profiles ─────────────────────────────────────────────────
  console.log('\n→ user_profiles')
  const { data: profiles } = await source.from('user_profiles').select('*')
  console.log(`  source: ${profiles?.length || 0} profiles`)
  if (profiles?.length) {
    const { error } = await target
      .from('user_profiles')
      .upsert(profiles, { onConflict: 'id' })
    if (error) throw new Error(`user_profiles upsert: ${error.message}`)
    console.log(`  ✅ migrados`)
  }

  // ─── 2. closers ───────────────────────────────────────────────────────
  console.log('\n→ closers')
  const { data: closers } = await source.from('closers').select('*')
  console.log(`  source: ${closers?.length || 0} closers`)
  if (closers?.length) {
    const { error } = await target.from('closers').upsert(closers, { onConflict: 'id' })
    if (error) throw new Error(`closers upsert: ${error.message}`)
    console.log(`  ✅ migrados`)
  }

  // ─── 3. bookings ──────────────────────────────────────────────────────
  console.log('\n→ bookings')
  const { data: bookings } = await source.from('bookings').select('*')
  console.log(`  source: ${bookings?.length || 0} bookings`)
  if (bookings?.length) {
    // Insere em lotes pra evitar timeout em volumes maiores.
    const batchSize = 100
    for (let i = 0; i < bookings.length; i += batchSize) {
      const batch = bookings.slice(i, i + batchSize)
      const { error } = await target.from('bookings').upsert(batch, { onConflict: 'id' })
      if (error) throw new Error(`bookings upsert (batch ${i}): ${error.message}`)
      console.log(`  ✅ batch ${i}-${i + batch.length} de ${bookings.length}`)
    }
  }

  console.log('\n━'.repeat(70))
  console.log('✅ Migração concluída')
}

run().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exit(1)
})
