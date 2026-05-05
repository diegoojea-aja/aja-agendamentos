/**
 * Cria/atualiza Bruno Henrique e Victor Volponi como admins.
 * Senha temporária: AjaForms@2026* (eles trocam no primeiro login).
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const ADMINS = [
  { email: 'atendimento@ajaeducacao.com.br', name: 'Bruno Henrique' },
  { email: 'victorvolponi@ajaeducacao.com.br', name: 'Victor Volponi' },
]

const PASSWORD = 'AjaForms@2026*'

async function upsertAdmin({ email, name }: { email: string; name: string }) {
  console.log(`\n🔑 Processando ${email} (${name})`)

  // 1. Encontra ou cria auth user
  const { data: existing } = await supabase.auth.admin.listUsers()
  const found = existing?.users?.find((u) => u.email === email)

  let userId: string
  if (found) {
    console.log('  👤 Auth user já existe, atualizando senha + name')
    const { error } = await supabase.auth.admin.updateUserById(found.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name },
    })
    if (error) throw error
    userId = found.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`  ✅ Auth user criado: ${userId}`)
  }

  // 2. Upsert profile como admin
  const { error: profileErr } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        email,
        name,
        role: 'admin',
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

  if (profileErr) throw profileErr
  console.log(`  ✅ Profile admin (active)`)
}

async function run() {
  for (const admin of ADMINS) {
    await upsertAdmin(admin)
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`✅ Concluído. Senha temporária: ${PASSWORD}`)
  console.log(`   Login em: forms.ajaeducacao.com.br/login`)
  console.log(`   Recomende trocar a senha no primeiro acesso.`)
}

run().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exit(1)
})
