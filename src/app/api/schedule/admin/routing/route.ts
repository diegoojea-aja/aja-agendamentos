import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { requireAdmin } from '@/lib/auth-helpers'
import {
  COUNTABLE_STATUSES,
  normalizeScore,
  rollingWindowStart,
  scoreCandidates,
  SCORE_BUCKETS,
  type CloserCounts,
  type ScoreBucket,
} from '@/lib/routing'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const ALL_BUCKETS: ScoreBucket[] = [...SCORE_BUCKETS, 'Sem score']

interface CloserRow {
  id: string
  name: string
  slug: string
  email: string
  active: boolean
  weight: number
  accepts_scores: string[] | null
  accepts_products: string[] | null
  last_assigned_at: string | null
}

/**
 * GET /api/schedule/admin/routing
 *
 * Snapshot da configuração de roteamento + distribuição real (últimos 30d) +
 * simulação de "quem levaria o próximo lead de cada tipo".
 */
export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'FORBIDDEN' },
      { status: 403 }
    )
  }

  const supabase = createServerClient()

  const { data: closers, error: closersErr } = await supabase
    .from('closers')
    .select('id, name, slug, email, active, weight, accepts_scores, accepts_products, last_assigned_at')
    .eq('active', true)
    .order('name')

  if (closersErr) {
    return NextResponse.json({ error: closersErr.message }, { status: 500 })
  }

  const rows = (closers || []) as CloserRow[]
  const windowStart = rollingWindowStart()

  // Distribuição últimos 30 dias por bucket
  const { data: recent } = await supabase
    .from('bookings')
    .select('closer_id, lead_score, status')
    .in('closer_id', rows.map((c) => c.id))
    .gte('date', windowStart)
    .in('status', COUNTABLE_STATUSES as unknown as string[])

  const countsByCloserId = new Map<string, CloserCounts>()
  for (const c of rows) {
    countsByCloserId.set(c.id, {
      closer_id: c.id,
      total: 0,
      byBucket: {
        'Muito Qualificado': 0,
        'Qualificado': 0,
        'Neutro': 0,
        'Semi Desqualificado': 0,
        'Sem score': 0,
      },
    })
  }
  for (const b of recent || []) {
    const counts = countsByCloserId.get(b.closer_id)
    if (!counts) continue
    counts.total += 1
    counts.byBucket[normalizeScore(b.lead_score)] += 1
  }

  // Simulação por bucket: quem levaria se chegasse um lead desse tipo agora
  // (ignorando disponibilidade de horário — só regras de elegibilidade).
  const simulation: Record<string, { closer_id: string; closer_name: string; reason: string } | null> = {}
  for (const bucket of ALL_BUCKETS) {
    const eligible = rows.filter((c) => {
      if (c.weight <= 0) return false
      if (c.accepts_scores && c.accepts_scores.length > 0 && !c.accepts_scores.includes(bucket)) {
        return false
      }
      return true
    })

    if (eligible.length === 0) {
      simulation[bucket] = null
      continue
    }

    const scored = scoreCandidates(eligible, bucket, countsByCloserId)
    const winner = scored[0]
    simulation[bucket] = {
      closer_id: winner.closer.id,
      closer_name: winner.closer.name,
      reason: `${winner.bucketCount} ${bucket}/30d, ${winner.totalCount} total/30d, peso ${winner.weight}`,
    }
  }

  const distribution = rows.map((c) => {
    const counts = countsByCloserId.get(c.id)!
    return {
      id: c.id,
      name: c.name,
      slug: c.slug,
      email: c.email,
      weight: c.weight,
      accepts_scores: c.accepts_scores || [],
      accepts_products: c.accepts_products || [],
      last_assigned_at: c.last_assigned_at,
      total: counts.total,
      by_bucket: counts.byBucket,
    }
  })

  return NextResponse.json({
    rolling_window_days: 30,
    countable_statuses: COUNTABLE_STATUSES,
    buckets: ALL_BUCKETS,
    closers: distribution,
    simulation,
  })
}

/**
 * PATCH /api/schedule/admin/routing
 *
 * Atualização inline pelo admin: ajusta peso e accepts_scores de uma closer.
 * Body: { closer_id, weight?, accepts_scores? }
 */
const patchSchema = z.object({
  closer_id: z.string().uuid(),
  weight: z.number().int().min(0).max(10).optional(),
  accepts_scores: z.array(z.enum([...SCORE_BUCKETS, 'Sem score'])).optional(),
})

export async function PATCH(request: NextRequest) {
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
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.issues },
      { status: 400 }
    )
  }

  const { closer_id, weight, accepts_scores } = parsed.data

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (weight !== undefined) update.weight = weight
  if (accepts_scores !== undefined) update.accepts_scores = accepts_scores

  if (Object.keys(update).length === 1) {
    return NextResponse.json({ error: 'Nada pra atualizar' }, { status: 400 })
  }

  const supabase = createServerClient()
  const { error } = await supabase.from('closers').update(update).eq('id', closer_id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
