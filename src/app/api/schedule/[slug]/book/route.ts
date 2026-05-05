import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { createEvent } from '@/lib/google-calendar'
import { checkRateLimit } from '@/lib/rate-limit'
import { getOptionalUserId } from '@/lib/auth-helpers'
import { logError } from '@/lib/logger'
import { z } from 'zod'

const bookingSchema = z.object({
  lead_name: z.string().min(1, 'Nome obrigatório'),
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
  rescheduled_from_id: z.string().uuid().optional(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  // 10 bookings/min por IP — gera bookings reais com side-effect (Calendar API,
  // hub-cs intake), tem que ser mais conservador.
  const limited = checkRateLimit(request, {
    limit: 10,
    windowMs: 60_000,
    keyPrefix: 'book',
  })
  if (limited) return limited

  const { slug } = await params
  const supabase = createServerClient()

  // Se SDR estiver logado (Bearer token), captura user id pra link em sdr_user_id.
  const sdrUserId = await getOptionalUserId(request)

  // 1. Buscar closer
  const { data: closer, error: closerErr } = await supabase
    .from('closers')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (closerErr || !closer) {
    return NextResponse.json({ error: 'Closer não encontrada' }, { status: 404 })
  }

  // 2. Validar body
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const parsed = bookingSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: parsed.error.issues },
      { status: 400 }
    )
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
    rescheduled_from_id,
  } = parsed.data

  // Calcular time_end
  const [h, m] = time_start.split(':').map(Number)
  const endMin = h * 60 + m + duration
  const time_end = `${String(Math.floor(endMin / 60)).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`

  // 3. Verificar conflito (double-booking prevention)
  const { data: conflicts } = await supabase
    .from('bookings')
    .select('id')
    .eq('closer_id', closer.id)
    .eq('date', date)
    .eq('status', 'confirmed')
    .lt('time_start', time_end)
    .gt('time_end', time_start)

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json(
      { error: 'Horário já reservado. Escolha outro.' },
      { status: 409 }
    )
  }

  // 4. Criar evento no Google Calendar (se configurado)
  // Descrição limpa pro lead — dados internos ficam só no Supabase.
  let googleEventId: string | null = null
  let meetLink: string | null = null
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      const firstName = lead_name.trim().split(/\s+/)[0]
      const desc = [
        `Olá ${firstName}! Sua reunião com ${closer.name} está confirmada.`,
        '',
        `Duração: ${duration} minutos`,
        '',
        'O link do Google Meet está anexado a este evento.',
        'Qualquer dúvida antes da reunião, é só nos chamar.',
        '',
        '— Equipe AJA Educação',
      ].join('\n')

      const result = await createEvent(closer.email, {
        title: `Reunião ${closer.name} × ${lead_name} — AJA Educação`,
        description: desc,
        date,
        timeStart: time_start,
        timeEnd: time_end,
        leadEmail: lead_email || undefined,
      })
      googleEventId = result.eventId
      meetLink = result.meetLink
    }
  } catch (err) {
    logError('schedule/book.calendar', err, { closer: slug, date, time_start })
    // Não bloqueia — salva booking mesmo sem Google Calendar
  }

  // 5. Salvar booking
  const { data: booking, error: bookErr } = await supabase
    .from('bookings')
    .insert({
      closer_id: closer.id,
      lead_name,
      lead_email,
      lead_phone,
      zoho_id,
      sdr_name: sdr_name || null,
      sdr_user_id: sdrUserId,
      sdr_note: sdr_note || null,
      lead_score: lead_score || null,
      lead_registered_at: lead_registered_at || null,
      funnel: funnel || 'Sessão',
      observations: observations || null,
      date,
      time_start,
      time_end,
      duration,
      status: 'confirmed',
      google_event_id: googleEventId,
      meet_link: meetLink,
      rescheduled_from_id: rescheduled_from_id || null,
    })
    .select()
    .single()

  if (bookErr) {
    logError('schedule/book.insert', bookErr, { closer: slug, date, time_start })
    return NextResponse.json({ error: 'Erro ao salvar agendamento' }, { status: 500 })
  }

  return NextResponse.json(
    {
      success: true,
      booking: {
        id: booking.id,
        closer: closer.name,
        closer_photo: closer.photo_url || null,
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
    },
    { status: 201 }
  )
}
