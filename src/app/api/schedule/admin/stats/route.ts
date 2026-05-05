import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'

/**
 * GET /api/schedule/admin/stats
 *
 * Retorna estatísticas de agendamento pra view admin:
 * - Distribuição por closer (bookings no mês)
 * - Total de bookings, hoje, esta semana
 * - Lista de bookings com detalhes
 */
export async function GET() {
  const supabase = createServerClient()

  const now = new Date()
  const todayStr = now.toLocaleDateString('sv-SE')
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

  // Week start (monday)
  const dayOfWeek = now.getDay()
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() + mondayOffset)
  const weekStartStr = weekStart.toLocaleDateString('sv-SE')

  const [
    closersRes,
    allBookingsRes,
    todayBookingsRes,
    weekBookingsRes,
    monthBookingsRes,
  ] = await Promise.all([
    supabase.from('closers').select('id, name, slug, email, active').order('name'),
    supabase
      .from('bookings')
      .select('id, closer_id, lead_name, lead_email, lead_phone, zoho_id, sdr_name, sdr_note, lead_score, lead_registered_at, funnel, observations, date, time_start, time_end, duration, status, google_event_id, meet_link, created_at')
      .gte('date', monthStart)
      .order('date', { ascending: true })
      .order('time_start', { ascending: true }),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('date', todayStr)
      .eq('status', 'confirmed'),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('date', weekStartStr)
      .eq('status', 'confirmed'),
    supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .gte('date', monthStart)
      .eq('status', 'confirmed'),
  ])

  const closers = closersRes.data || []
  const allBookings = allBookingsRes.data || []

  // Distribution por closer no mês
  const distribution = closers.map((closer) => {
    const closerBookings = allBookings.filter(
      (b) => b.closer_id === closer.id && b.status === 'confirmed'
    )
    return {
      id: closer.id,
      name: closer.name,
      slug: closer.slug,
      active: closer.active,
      bookings_month: closerBookings.length,
      bookings_total_hours: closerBookings.reduce((sum, b) => sum + (b.duration || 60), 0) / 60,
    }
  })

  // Ordenar por mais bookings
  distribution.sort((a, b) => b.bookings_month - a.bookings_month)

  // Max booking count (pra barra proporcional)
  const maxBookings = Math.max(...distribution.map((d) => d.bookings_month), 1)

  // Verificar equilíbrio (Calendly usa threshold de 3)
  const counts = distribution.filter((d) => d.active).map((d) => d.bookings_month)
  const minCount = Math.min(...counts, 0)
  const maxCount = Math.max(...counts, 0)
  const isBalanced = maxCount - minCount <= 3

  // Bookings com nome do closer
  const closerMap = Object.fromEntries(closers.map((c) => [c.id, c]))
  const bookingsWithCloser = allBookings.map((b) => ({
    ...b,
    closer_name: closerMap[b.closer_id]?.name || 'Desconhecido',
    closer_slug: closerMap[b.closer_id]?.slug || '',
  }))

  return NextResponse.json({
    stats: {
      today: todayBookingsRes.count || 0,
      this_week: weekBookingsRes.count || 0,
      this_month: monthBookingsRes.count || 0,
      is_balanced: isBalanced,
      balance_gap: maxCount - minCount,
    },
    distribution,
    max_bookings: maxBookings,
    bookings: bookingsWithCloser,
  })
}
