import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getFreeBusy, computeAvailableSlots } from '@/lib/google-calendar'

/**
 * GET /api/schedule/auto/slots?date=YYYY-MM-DD&duration=30
 *
 * Retorna todos os horários em que PELO MENOS 1 closer está disponível.
 * Usado no fluxo de auto-distribuição.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const date = searchParams.get('date')
  const duration = parseInt(searchParams.get('duration') || '30', 10)

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date required (YYYY-MM-DD)' }, { status: 400 })
  }
  if (![30, 60].includes(duration)) {
    return NextResponse.json({ error: 'duration must be 30 or 60' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: closers, error } = await supabase
    .from('closers')
    .select('*')
    .eq('active', true)

  if (error || !closers?.length) {
    return NextResponse.json({ error: 'Nenhuma closer ativa' }, { status: 404 })
  }

  const hasGoogleKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY

  // Pra cada closer, computar slots disponíveis
  const allSlotSets: Map<string, string[]> = new Map() // slot → closerSlugs que têm esse slot livre
  const slotSet = new Set<string>()

  for (const closer of closers) {
    const wh = closer.working_hours as {
      start: string; end: string; lunch_start: string; lunch_end: string; days: number[]
    }

    let busy: { start: string; end: string }[] = []
    if (hasGoogleKey) {
      try {
        busy = await getFreeBusy(closer.email, date)
      } catch (err) {
        console.error(`[auto/slots] Google Calendar error for ${closer.email}:`, err)
      }
    }

    const closerSlots = computeAvailableSlots(wh, busy, date, duration, closer.buffer_minutes || 15)

    for (const slot of closerSlots) {
      slotSet.add(slot)
      const existing = allSlotSets.get(slot) || []
      existing.push(closer.slug)
      allSlotSets.set(slot, existing)
    }
  }

  // Ordenar slots cronologicamente
  const slots = Array.from(slotSet).sort()

  return NextResponse.json({
    date,
    duration,
    slots,
    closers_count: closers.length,
    ...(!hasGoogleKey ? { _warning: 'Google Calendar não configurado — slots teóricos' } : {}),
  })
}
