import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getFreeBusy, computeAvailableSlots } from '@/lib/google-calendar'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { searchParams } = request.nextUrl
  const date = searchParams.get('date')
  const duration = parseInt(searchParams.get('duration') || '30', 10)

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: 'date param required (YYYY-MM-DD)' }, { status: 400 })
  }

  if (![30, 60].includes(duration)) {
    return NextResponse.json({ error: 'duration must be 30 or 60' }, { status: 400 })
  }

  const supabase = createServerClient()

  const { data: closer, error } = await supabase
    .from('closers')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single()

  if (error || !closer) {
    return NextResponse.json({ error: 'Closer não encontrada' }, { status: 404 })
  }

  try {
    const busy = await getFreeBusy(closer.email, date)
    const workingHours = closer.working_hours as {
      start: string
      end: string
      lunch_start: string
      lunch_end: string
      days: number[]
    }

    const slots = computeAvailableSlots(
      workingHours,
      busy,
      date,
      duration,
      closer.buffer_minutes || 15
    )

    return NextResponse.json({
      closer: { name: closer.name, slug: closer.slug },
      date,
      duration,
      slots,
    })
  } catch (err) {
    // Se Google Calendar não está configurado, retorna slots teóricos
    // (sem verificar ocupação real) pra não travar o desenvolvimento
    const hasGoogleKey = !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    if (!hasGoogleKey) {
      const workingHours = closer.working_hours as {
        start: string; end: string; lunch_start: string; lunch_end: string; days: number[]
      }
      const slots = computeAvailableSlots(workingHours, [], date, duration, closer.buffer_minutes || 15)
      return NextResponse.json({
        closer: { name: closer.name, slug: closer.slug },
        date,
        duration,
        slots,
        _warning: 'Google Calendar não configurado — mostrando slots teóricos',
      })
    }

    console.error('[schedule/slots]', err)
    return NextResponse.json(
      { error: 'Erro ao consultar disponibilidade' },
      { status: 500 }
    )
  }
}
