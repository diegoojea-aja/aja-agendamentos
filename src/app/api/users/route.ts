import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
  role: z.enum(['admin', 'sdr', 'comercial', 'cs', 'eventos', 'closer']),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    return NextResponse.json({ error: code }, { status: 403 })
  }

  const supabase = adminClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id, email, name, role, active, created_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (err) {
    const code = err instanceof Error ? err.message : 'UNKNOWN'
    return NextResponse.json({ error: code }, { status: 403 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = createUserSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { email, password, name, role } = parsed.data
  const supabase = adminClient()

  // 1. Criar no auth
  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name, role },
  })

  if (authErr) {
    if (authErr.message.includes('already')) {
      return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 409 })
    }
    return NextResponse.json({ error: authErr.message }, { status: 500 })
  }

  // 2. Criar profile
  const { error: profileErr } = await supabase.from('user_profiles').insert({
    id: created.user.id,
    email,
    name,
    role,
    active: true,
  })

  if (profileErr) {
    // Rollback — deletar auth user se profile falhou
    await supabase.auth.admin.deleteUser(created.user.id).catch(() => {})
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  return NextResponse.json(
    { id: created.user.id, email, name, role, active: true },
    { status: 201 }
  )
}
