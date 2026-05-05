import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { resolve } from 'path'

dotenv.config({ path: resolve(__dirname, '../.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const EMAIL = 'diego.ojea@ajaeducacao.com.br'
const PASSWORD = 'Aja@2026*'

async function run() {
  // Try to list users to see if diego already exists
  const { data: existing } = await supabase.auth.admin.listUsers()
  const found = existing?.users.find((u) => u.email === EMAIL)

  if (found) {
    console.log(`📝 Usuário já existe (id: ${found.id}). Atualizando senha...`)
    const { error } = await supabase.auth.admin.updateUserById(found.id, {
      password: PASSWORD,
    })
    if (error) {
      console.error('❌ Erro ao atualizar senha:', error)
      process.exit(1)
    }
    console.log('✅ Senha atualizada.')
  } else {
    console.log('🆕 Criando usuário...')
    const { data, error } = await supabase.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) {
      console.error('❌ Erro ao criar:', error)
      process.exit(1)
    }
    console.log(`✅ Usuário criado. ID: ${data.user.id}`)
  }

  console.log(`\n🔐 Login: ${EMAIL}`)
  console.log(`🔐 Senha: ${PASSWORD}`)
}

run()
