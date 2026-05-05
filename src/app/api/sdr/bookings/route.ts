import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { requireRole } from '@/lib/auth-helpers'
import { logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sdr/bookings
 *
 * Lista bookings criados pelo SDR autenticado (read-only).
 * Filtro principal: sdr_user_id == profile.id.
 * Fallback: sdr_name == profile.name pra bookings antigos sem link.
 */
export async function GET(request: NextRequest) {
  let profile
  try {
    profile = await requireRole(request, ['sdr'])
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'FORBIDDEN' },
      { status: 403 }
    )
  }

  const supabase = createServerClient()

  try {
    const [byIdRes, byNameRes, closersRes] = await Promise.all([
      supabase
        .from('bookings')
        .select('id, closer_id, lead_name, lead_email, lead_phone, zoho_id, sdr_name, funnel, date, time_start, time_end, duration, status, lost_reason, meet_link, created_at')
        .eq('sdr_user_id', profile.id)
        .order('date', { ascending: false })
        .order('time_start', { ascending: false })
        .limit(500),
      profile.name
        ? supabase
            .from('bookings')
            .select('id, closer_id, lead_name, lead_email, lead_phone, zoho_id, sdr_name, funnel, date, time_start, time_end, duration, status, lost_reason, meet_link, created_at')
            .is('sdr_user_id', null)
            .ilike('sdr_name', profile.name)
            .order('date', { ascending: false })
            .order('time_start', { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('closers').select('id, name, slug'),
    ])

    if (byIdRes.error) throw byIdRes.error
    if (byNameRes.error) throw byNameRes.error

    const closersMap = Object.fromEntries((closersRes.data || []).map((c) => [c.id, c]))
    const seen = new Set<string>()
    const merged = [...(byIdRes.data || []), ...(byNameRes.data || [])]
      .filter((b) => {
        if (seen.has(b.id)) return false
        seen.add(b.id)
        return true
      })
      .map((b) => ({
        ...b,
        closer_name: closersMap[b.closer_id]?.name || 'Desconhecido',
        closer_slug: closersMap[b.closer_id]?.slug || '',
      }))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? 1 : -1
        return a.time_start < b.time_start ? 1 : -1
      })

    return NextResponse.json({ bookings: merged, sdr: { id: profile.id, name: profile.name } })
  } catch (err) {
    logError('sdr/bookings.list', err, { sdr_id: profile.id })
    return NextResponse.json({ error: 'Erro ao listar agendamentos' }, { status: 500 })
  }
}
