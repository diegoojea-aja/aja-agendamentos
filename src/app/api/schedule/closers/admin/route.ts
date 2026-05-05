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

const workingHoursSchema = z.object({
  start: z.string().regex(/^\d{2}:\d{2}$/),
  end: z.string().regex(/^\d{2}:\d{2}$/),
  lunch_start: z.string().regex(/^\d{2}:\d{2}$/),
  lunch_end: z.string().regex(/^\d{2}:\d{2}$/),
  days: z.array(z.number().int().min(1).max(7)),
})

const closerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  slug: z.string().min(1).regex(/^[a-z0-9-]+$/),
  photo_url: z.string().url().optional().or(z.literal('')),
  active: z.boolean().optional(),
  weight: z.number().int().min(0).max(10).optional(),
  slack_user_id: z.string().optional().or(z.literal('')),
  accepts_products: z.array(z.string()).optional(),
  accepts_scores: z.array(z.string()).optional(),
  duration_options: z.array(z.number().int().refine((d) => [30, 60].includes(d))).optional(),
  working_hours: workingHoursSchema.optional(),
  buffer_minutes: z.number().int().min(0).max(60).optional(),
})

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'FORBIDDEN' },
      { status: 403 }
    )
  }

  const supabase = adminClient()
  const { data, error } = await supabase
    .from('closers')
    .select('*')
    .order('name')

  if (error) {
    logError('admin/closers.list', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'FORBIDDEN' },
      { status: 403 }
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = closerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const data = parsed.data
  const insertPayload: Record<string, unknown> = {
    name: data.name,
    email: data.email,
    slug: data.slug,
    photo_url: data.photo_url || null,
    active: data.active ?? true,
    weight: data.weight ?? 1,
    slack_user_id: data.slack_user_id || null,
    accepts_products: data.accepts_products ?? [],
    accepts_scores: data.accepts_scores ?? [],
    duration_options: data.duration_options ?? [30, 60],
    working_hours: data.working_hours ?? {
      start: '09:00',
      end: '19:00',
      lunch_start: '12:00',
      lunch_end: '13:00',
      days: [1, 2, 3, 4, 5],
    },
    buffer_minutes: data.buffer_minutes ?? 15,
  }

  const supabase = adminClient()
  const { data: created, error } = await supabase
    .from('closers')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    logError('admin/closers.create', error, { slug: data.slug })
    if (error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Já existe closer com esse slug ou email.' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(created, { status: 201 })
}
