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
  console.log('=== auth.users ===')
  const { data: authUsers } = await supabase.auth.admin.listUsers()
  for (const u of authUsers?.users || []) {
    console.log(`  ${u.id}  ${u.email}`)
  }

  console.log('\n=== user_profiles ===')
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('error:', error.message)
    return
  }
  for (const p of profiles || []) {
    console.log(`  ${p.id}  ${p.email}  role=${p.role}  active=${p.active}`)
  }
}

run()
