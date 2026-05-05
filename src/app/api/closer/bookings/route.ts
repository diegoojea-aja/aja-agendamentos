import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { requireRole } from '@/lib/auth-helpers'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/closer/bookings
 *
 * Lista bookings do closer autenticado.
 * Match: closers.email == profile.email (case-insensitive).
 * Retorna closer_id pra UI saber qual closer logou + bookings agrupáveis.
 */
export async function GET(request: NextRequest) {
  let profile
  try {
    profile = await requireRole(request, ['closer'])
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'FORBIDDEN' },
      { status: 403 }
    )
  }

  const supabase = createServerClient()

  try {
    const { data: closer, error: closerErr } = await supabase
      .from('closers')
      .select('id, name, slug, email')
      .ilike('email', profile.email)
      .maybeSingle()

    if (closerErr) throw closerErr
    if (!closer) {
      return NextResponse.json(
        { error: 'CLOSER_NOT_LINKED', message: `Nenhum closer cadastrado com email ${profile.email}. Peça pro admin vincular.` },
        { status: 404 }
      )
    }

    const { data: bookings, error: bErr } = await supabase
      .from('bookings')
      .select('id, lead_name, lead_email, lead_phone, zoho_id, sdr_name, funnel, observations, lead_score, lead_registered_at, date, time_start, time_end, duration, status, lost_reason, meet_link, rescheduled_from_id, status_marked_at, created_at')
      .eq('closer_id', closer.id)
      .order('date', { ascending: false })
      .order('time_start', { ascending: false })
      .limit(500)

    if (bErr) throw bErr

    return NextResponse.json({
      closer: { id: closer.id, name: closer.name, slug: closer.slug, email: closer.email },
      bookings: bookings || [],
    })
  } catch (err) {
    logError('closer/bookings.list', err, { closer_email: profile.email })
    return NextResponse.json({ error: 'Erro ao listar agendamentos' }, { status: 500 })
  }
}
