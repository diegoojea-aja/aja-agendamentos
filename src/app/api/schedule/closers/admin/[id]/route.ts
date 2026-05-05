import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth-helpers'
import { logError } from '@/lib/logger'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const adminClient = () =>
  createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/).optional(),
  photo_url: z.string().url().nullable().optional().or(z.literal('')),
  active: z.boolean().optional(),
  weight: z.number().int().min(0).max(10).optional(),
  slack_user_id: z.string().nullable().optional().or(z.literal('')),
  accepts_products: z.array(z.string()).optional(),
  accepts_scores: z.array(z.string()).optional(),
  duration_options: z.array(z.number().int().refine((d) => [30, 60].includes(d))).optional(),
  working_hours: z
    .object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      lunch_start: z.string().regex(/^\d{2}:\d{2}$/),
      lunch_end: z.string().regex(/^\d{2}:\d{2}$/),
      days: z.array(z.number().int().min(1).max(7)),
    })
    .optional(),
  buffer_minutes: z.number().int().min(0).max(60).optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin(request)
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
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.issues },
      { status: 400 }
    )
  }

  // Normaliza strings vazias pra null nos campos opcionais
  const update: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === '') {
      update[k] = null
    } else if (v !== undefined) {
      update[k] = v
    }
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nenhum campo pra atualizar' }, { status: 400 })
  }

  const supabase = adminClient()
  const { error } = await supabase.from('closers').update(update).eq('id', id)

  if (error) {
    logError('admin/closers.update', error, { closer_id: id })
    return NextResponse.json({ error: error.message }, { status: 500 })
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'FORBIDDEN' },
      { status: 403 }
    )
  }

  const { id } = await params
  const supabase = adminClient()
  const { error } = await supabase.from('closers').delete().eq('id', id)

  if (error) {
    logError('admin/closers.delete', error, { closer_id: id })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
