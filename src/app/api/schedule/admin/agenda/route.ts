import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { listEvents } from '@/lib/google-calendar'

/**
 * GET /api/schedule/admin/agenda?date=YYYY-MM-DD
 *
 * Retorna a agenda detalhada de cada closer no dia.
 */
export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date') || new Date().toLocaleDateString('sv-SE')

  const supabase = createServerClient()
  const { data: closers } = await supabase
    .from('closers')
    .select('id, name, email, slug, active')
    .eq('active', true)
    .order('name')

  if (!closers?.length) {
    return NextResponse.json({ error: 'Nenhuma closer ativa' }, { status: 404 })
  }

  const hasGoogleKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!hasGoogleKey) {
    return NextResponse.json({
      date,
      agendas: closers.map((c) => ({
        closer: { name: c.name, slug: c.slug, email: c.email },
        events: [],
        error: 'Google Calendar não configurado',
      })),
    })
  }

  const agendas = await Promise.all(
    closers.map(async (c) => {
      try {
        const events = await listEvents(c.email, date)
        return {
          closer: { name: c.name, slug: c.slug, email: c.email },
          events,
          error: null,
        }
      } catch (err) {
        return {
          closer: { name: c.name, slug: c.slug, email: c.email },
          events: [],
          error: err instanceof Error ? err.message : 'Erro desconhecido',
        }
      }
    })
  )

  return NextResponse.json({ date, agendas })
}
