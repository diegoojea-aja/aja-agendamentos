import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { logInfo, logWarn, logError } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/cron/check-pending-bookings
 *
 * Cron diário (configurado em vercel.json). Detecta bookings que já
 * passaram e ficaram sem marcação de status (closer esqueceu). Loga
 * e retorna lista pra UI futura ou notificação Slack.
 *
 * Lógica:
 *   - bookings com date < hoje e status='confirmed' = pending_review
 *   - bookings com date == hoje e status='confirmed' = upcoming hoje (info)
 *
 * Auth: Vercel Cron envia x-vercel-cron header. Em prod, exigimos.
 * Em dev, fica aberto (qualquer GET roda — útil pra testar manual).
 */

export async function GET(request: NextRequest) {
  // Em prod, valida que veio do Vercel Cron
  const isProd = process.env.NODE_ENV === 'production'
  if (isProd) {
    const cronHeader = request.headers.get('x-vercel-cron')
    const authHeader = request.headers.get('authorization')
    const expectedSecret = process.env.CRON_SECRET
    const okCron = !!cronHeader
    const okAuth = expectedSecret && authHeader === `Bearer ${expectedSecret}`
    if (!okCron && !okAuth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const supabase = createServerClient()
  const today = new Date().toLocaleDateString('sv-SE') // YYYY-MM-DD em local time

  try {
    // Bookings vencidos (date < hoje) ainda em 'confirmed'
    const { data: pendingReview, error: prErr } = await supabase
      .from('bookings')
      .select('id, closer_id, lead_name, date, time_start, zoho_id, sdr_name')
      .eq('status', 'confirmed')
      .lt('date', today)
      .order('date', { ascending: false })
      .limit(100)

    if (prErr) throw prErr

    // Bookings de hoje (info, não acionável ainda)
    const { count: upcomingToday } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'confirmed')
      .eq('date', today)

    const pendingCount = pendingReview?.length || 0

    if (pendingCount > 0) {
      logWarn('cron/pending-bookings', `${pendingCount} booking(s) pendente(s) de avaliação`, {
        count: pendingCount,
        oldest_date: pendingReview![pendingCount - 1]?.date,
      })
    } else {
      logInfo('cron/pending-bookings', 'Sem bookings pendentes', {
        upcoming_today: upcomingToday || 0,
      })
    }

    return NextResponse.json({
      ok: true,
      ts: new Date().toISOString(),
      pending_review_count: pendingCount,
      upcoming_today: upcomingToday || 0,
      pending_review: pendingReview || [],
    })
  } catch (err) {
    logError('cron/pending-bookings', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'unknown' },
      { status: 500 }
    )
  }
}
