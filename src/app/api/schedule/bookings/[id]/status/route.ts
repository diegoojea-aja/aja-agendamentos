import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireRole } from '@/lib/auth-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const statusSchema = z.object({
  status: z.enum(['confirmed', 'completed', 'no_show', 'cancelled', 'rescheduled', 'lost']),
  lost_reason: z.string().optional(),
})

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let profile
  try {
    profile = await requireRole(request, ['closer'])
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'FORBIDDEN' },
      { status: 403 }
    )
  }

  const { id } = await params

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = statusSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { status, lost_reason } = parsed.data
  const supabase = adminClient()

  // Closer só pode marcar status no próprio booking. Admin passa direto.
  if (profile.role === 'closer') {
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, closer_id, closers!inner(email)')
      .eq('id', id)
      .maybeSingle()

    const linkedEmail = (booking as { closers?: { email?: string } } | null)
      ?.closers?.email
    if (!booking || !linkedEmail || linkedEmail.toLowerCase() !== profile.email.toLowerCase()) {
      return NextResponse.json({ error: 'FORBIDDEN_NOT_OWNER' }, { status: 403 })
    }
  }

  const update: Record<string, unknown> = {
    status,
    status_marked_at: new Date().toISOString(),
    status_marked_by: UUID_RX.test(profile.id) ? profile.id : null,
  }
  if (status === 'lost') {
    update.lost_reason = lost_reason || null
  }

  const { error } = await supabase
    .from('bookings')
    .update(update)
    .eq('id', id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
