import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.enum(['admin', 'sdr', 'comercial', 'cs', 'eventos', 'closer']).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'FORBIDDEN' }, { status: 403 })
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.issues }, { status: 400 })
  }

  const { name, role, active, password } = parsed.data
  const supabase = adminClient()

  // Atualizar profile
  const profileUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) profileUpdate.name = name
  if (role !== undefined) profileUpdate.role = role
  if (active !== undefined) profileUpdate.active = active

  if (Object.keys(profileUpdate).length > 1) {
    const { error: profileErr } = await supabase
      .from('user_profiles')
      .update(profileUpdate)
      .eq('id', id)
    if (profileErr) {
      return NextResponse.json({ error: profileErr.message }, { status: 500 })
    }
  }

  // Atualizar senha se fornecida
  if (password) {
    const { error: authErr } = await supabase.auth.admin.updateUserById(id, { password })
    if (authErr) {
      return NextResponse.json({ error: authErr.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'FORBIDDEN' }, { status: 403 })
  }

  const { id } = await params
  const supabase = adminClient()

  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
