import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function run() {
  const email = 'fellipe.costa@ajaeducacao.com.br'
  const password = 'AjaForms@2026*'
  const name = 'Fellipe Costa'
  const role = 'admin'

  console.log(`🔑 Criando ${email} como ${role}`)

  // 1. Cria ou atualiza auth user
  const { data: existing } = await supabase.auth.admin.listUsers()
  const found = existing?.users?.find((u) => u.email === email)

  let userId: string
  if (found) {
    console.log('👤 Auth user já existe, atualizando senha')
    const { error } = await supabase.auth.admin.updateUserById(found.id, {
      password,
      email_confirm: true,
    })
    if (error) throw error
    userId = found.id
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    if (error) throw error
    userId = data.user.id
    console.log(`✅ Auth user criado: ${userId}`)
  }

  // 2. Upsert no user_profiles
  const { error: profileErr } = await supabase
    .from('user_profiles')
    .upsert(
      {
        id: userId,
        email,
        name,
        role,
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )

  if (profileErr) {
    console.error('❌ user_profiles error:', profileErr.message)
    process.exit(1)
  }

  console.log(`✅ Profile upserted (role=${role})`)
  console.log(`\n📧 ${email}`)
  console.log(`🔒 ${password}`)
}

run().catch((e) => {
  console.error('❌', e instanceof Error ? e.message : e)
  process.exit(1)
})
