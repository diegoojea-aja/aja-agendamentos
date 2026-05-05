import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getFreeBusy, computeAvailableSlots, createEvent } from '@/lib/google-calendar'
import { checkRateLimit } from '@/lib/rate-limit'
import { getOptionalUserId } from '@/lib/auth-helpers'
import { logError } from '@/lib/logger'
import {
  acceptsProduct,
  acceptsScore,
  buildChosenReason,
  COUNTABLE_STATUSES,
  normalizeScore,
  rollingWindowStart,
  scoreCandidates,
  type CloserCounts,
  type ScoreBucket,
  SCORE_BUCKETS,
} from '@/lib/routing'
import { z } from 'zod'

/**
 * POST /api/schedule/auto/book
 *
 * Distribui o agendamento usando a regra de roteamento (src/lib/routing.ts):
 * - Filtra closers elegíveis (ativos, peso > 0, livres no horário,
 *   aceitam o score e o produto/funil do lead).
 * - Pontua cada candidata pela carga balanceada (bucket + total nos
 *   últimos 30 dias, normalizada pelo peso) e desempata por
 *   round-robin determinístico (last_assigned_at).
 * - Atualiza last_assigned_at da escolhida pra preservar fairness.
 */

const bookingSchema = z.object({
  lead_name: z.string().min(1),
  lead_email: z.string().email('Email inválido'),
  lead_phone: z.string().min(1, 'Telefone obrigatório'),
  zoho_id: z.string().min(1, 'ID Zoho obrigatório'),
  sdr_name: z.string().optional(),
  sdr_note: z.string().optional(),
  lead_score: z.string().optional(),
  lead_registered_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  funnel: z.string().optional(),
  observations: z.string().optional().or(z.literal('')),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time_start: z.string().regex(/^\d{2}:\d{2}$/),
  duration: z.number().refine((d) => [30, 60].includes(d)),
})

export async function POST(request: NextRequest) {
  const limited = checkRateLimit(request, {
    limit: 10,
    windowMs: 60_000,
    keyPrefix: 'book',
  })
  if (limited) return limited

  const supabase = createServerClient()
  const sdrUserId = await getOptionalUserId(request)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = bookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Dados inválidos', details: parsed.error.issues }, { status: 400 })
  }

  const {
    lead_name,
    lead_email,
    lead_phone,
    zoho_id,
    sdr_name,
    sdr_note,
    lead_score,
    lead_registered_at,
    funnel,
    observations,
    date,
    time_start,
    duration,
  } = parsed.data

  const bucket: ScoreBucket = normalizeScore(lead_score)
  const funnelValue = funnel || 'Sessão'

  const [h, m] = time_start.split(':').map(Number)
  const endMin = h * 60 + m + duration
  const time_end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`

  // 1. Closers ativos (incluindo peso 0 — filtramos depois).
  const { data: closers } = await supabase.from('closers').select('*').eq('active', true)

  if (!closers?.length) {
    return NextResponse.json({ error: 'Nenhuma closer ativa' }, { status: 404 })
  }

  // 2. Filtrar por peso > 0, accepts_scores, accepts_products
  const eligibleByConfig = closers.filter((c) => {
    const weight = (c as { weight?: number }).weight ?? 1
    if (weight <= 0) return false
    if (!acceptsScore((c as { accepts_scores?: string[] }).accepts_scores, bucket)) return false
    if (!acceptsProduct((c as { accepts_products?: string[] }).accepts_products, funnelValue)) return false
    return true
  })

  if (eligibleByConfig.length === 0) {
    return NextResponse.json(
      { error: `Nenhuma closer aceita "${bucket}" no funil "${funnelValue}".` },
      { status: 409 }
    )
  }

  // 3. Filtrar por disponibilidade no horário
  const hasGoogleKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const available: typeof closers = []

  for (const closer of eligibleByConfig) {
    const wh = closer.working_hours as {
      start: string; end: string; lunch_start: string; lunch_end: string; days: number[]
    }

    let busy: { start: string; end: string }[] = []
    if (hasGoogleKey) {
      try {
        busy = await getFreeBusy(closer.email, date)
      } catch {
        // Se falhar pra uma closer, ignora e tenta as outras
      }
    }

    const slots = computeAvailableSlots(wh, busy, date, duration, closer.buffer_minutes || 15)
    if (slots.includes(time_start)) {
      available.push(closer)
    }
  }

  if (available.length === 0) {
    return NextResponse.json(
      { error: 'Nenhuma closer disponível neste horário com as regras atuais.' },
      { status: 409 }
    )
  }

  // 4. Buscar bookings dos últimos 30d das candidatas pra contagem por bucket
  const windowStart = rollingWindowStart()
  const candidateIds = available.map((c) => c.id)

  const { data: recentBookings } = await supabase
    .from('bookings')
    .select('closer_id, lead_score, status')
    .in('closer_id', candidateIds)
    .gte('date', windowStart)
    .in('status', COUNTABLE_STATUSES as unknown as string[])

  const countsByCloserId = new Map<string, CloserCounts>()
  for (const id of candidateIds) {
    countsByCloserId.set(id, {
      closer_id: id,
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
  for (const b of recentBookings || []) {
    const counts = countsByCloserId.get(b.closer_id)
    if (!counts) continue
    counts.total += 1
    const bkt = normalizeScore(b.lead_score)
    counts.byBucket[bkt] += 1
  }

  // 5. Pontuar e escolher
  const scored = scoreCandidates(available, bucket, countsByCloserId)
  const chosen = scored[0].closer

  // 6. Conflito tabela bookings (double-booking prevention)
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('id')
    .eq('closer_id', chosen.id)
    .eq('date', date)
    .eq('status', 'confirmed')
    .lt('time_start', time_end)
    .gt('time_end', time_start)

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ error: 'Horário acabou de ser reservado. Tente outro.' }, { status: 409 })
  }

  // 7. Google Calendar
  let googleEventId: string | null = null
  let meetLink: string | null = null
  if (hasGoogleKey) {
    try {
      const firstName = lead_name.trim().split(/\s+/)[0]
      const desc = [
        `Olá ${firstName}! Sua reunião com ${chosen.name} está confirmada.`,
        '',
        `Duração: ${duration} minutos`,
        '',
        'O link do Google Meet está anexado a este evento.',
        'Qualquer dúvida antes da reunião, é só nos chamar.',
        '',
        '— Equipe AJA Educação',
      ].join('\n')

      const result = await createEvent(chosen.email, {
        title: `Reunião ${chosen.name} × ${lead_name} — AJA Educação`,
        description: desc,
        date,
        timeStart: time_start,
        timeEnd: time_end,
        leadEmail: lead_email || undefined,
      })
      googleEventId = result.eventId
      meetLink = result.meetLink
    } catch (err) {
      logError('schedule/auto/book.calendar', err, { closer: chosen.slug, date, time_start })
    }
  }

  // 8. Insert booking
  const { data: booking, error: bookErr } = await supabase
    .from('bookings')
    .insert({
      closer_id: chosen.id,
      lead_name,
      lead_email,
      lead_phone,
      zoho_id,
      sdr_name: sdr_name || null,
      sdr_user_id: sdrUserId,
      sdr_note: sdr_note || null,
      lead_score: lead_score || null,
      lead_registered_at: lead_registered_at || null,
      funnel: funnelValue,
      observations: observations || null,
      date,
      time_start,
      time_end,
      duration,
      status: 'confirmed',
      google_event_id: googleEventId,
      meet_link: meetLink,
    })
    .select()
    .single()

  if (bookErr) {
    logError('schedule/auto/book.insert', bookErr, { closer: chosen.slug, date, time_start })
    return NextResponse.json({ error: 'Erro ao salvar agendamento' }, { status: 500 })
  }

  // 9. Atualiza last_assigned_at pra round-robin (não bloqueia se falhar)
  await supabase
    .from('closers')
    .update({ last_assigned_at: new Date().toISOString() })
    .eq('id', chosen.id)

  return NextResponse.json(
    {
      success: true,
      booking: {
        id: booking.id,
        closer: chosen.name,
        closer_slug: chosen.slug,
        closer_photo: chosen.photo_url || null,
        date,
        time_start,
        time_end,
        duration,
        lead_name,
        lead_phone: lead_phone || null,
        zoho_id,
        meet_link: meetLink,
        google_synced: !!googleEventId,
      },
      distribution: {
        score_bucket: bucket,
        funnel: funnelValue,
        eligible_total: eligibleByConfig.length,
        available_total: available.length,
        chosen_reason: buildChosenReason(scored[0], bucket, available.length),
      },
    },
    { status: 201 }
  )
}

// Re-export pra TS conferir que SCORE_BUCKETS é referenciado no schema futuro.
export const dynamic = 'force-dynamic'
void SCORE_BUCKETS
