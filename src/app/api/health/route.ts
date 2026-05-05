import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase-server'
import { getFreeBusy } from '@/lib/google-calendar'
import { logWarn } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * GET /api/health
 *
 * Smoke test dos serviços críticos. Retorna status 200 se tudo OK,
 * 503 se algum serviço crítico falha.
 *
 * Usado pra:
 *   - UptimeRobot (cron externo) detectar downtime do hub-cs ou Google Calendar
 *   - Debug rápido em prod ("o que tá quebrado agora?")
 *
 * Não revela dados sensíveis — só status agregado de cada dependência.
 */

interface ServiceCheck {
  name: string
  status: 'ok' | 'fail' | 'skipped'
  latency_ms?: number
  message?: string
}

async function checkSupabase(): Promise<ServiceCheck> {
  const start = Date.now()
  try {
    const sb = createServerClient()
    const { error } = await sb.from('forms').select('id', { head: true, count: 'exact' }).limit(1)
    if (error) throw error
    return { name: 'supabase', status: 'ok', latency_ms: Date.now() - start }
  } catch (err) {
    return {
      name: 'supabase',
      status: 'fail',
      latency_ms: Date.now() - start,
      message: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function checkHubCs(): Promise<ServiceCheck> {
  const url = process.env.HUB_CS_INTAKE_URL
  if (!url) return { name: 'hub_cs', status: 'skipped', message: 'HUB_CS_INTAKE_URL não setado' }

  const start = Date.now()
  try {
    // Faz POST com payload inválido propositalmente — esperamos 400 (validação),
    // que confirma que o endpoint está vivo. 401 também conta (auth ativo).
    // 5xx = serviço com problema.
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _ping: true }),
      signal: AbortSignal.timeout(5000),
    })
    const latency = Date.now() - start
    if (res.status >= 500) {
      return { name: 'hub_cs', status: 'fail', latency_ms: latency, message: `HTTP ${res.status}` }
    }
    return { name: 'hub_cs', status: 'ok', latency_ms: latency, message: `HTTP ${res.status}` }
  } catch (err) {
    return {
      name: 'hub_cs',
      status: 'fail',
      latency_ms: Date.now() - start,
      message: err instanceof Error ? err.message : 'unknown',
    }
  }
}

async function checkGoogleCalendar(): Promise<ServiceCheck> {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return { name: 'google_calendar', status: 'skipped', message: 'GOOGLE_SERVICE_ACCOUNT_KEY não setado' }
  }

  const start = Date.now()
  try {
    // Usa a primeira closer ativa do banco como sujeito de impersonation.
    const sb = createServerClient()
    const { data: closer } = await sb
      .from('closers')
      .select('email')
      .eq('active', true)
      .limit(1)
      .maybeSingle()

    if (!closer) {
      return { name: 'google_calendar', status: 'skipped', message: 'sem closers ativas pra testar' }
    }

    const today = new Date().toLocaleDateString('sv-SE')
    await getFreeBusy(closer.email, today)
    return { name: 'google_calendar', status: 'ok', latency_ms: Date.now() - start }
  } catch (err) {
    return {
      name: 'google_calendar',
      status: 'fail',
      latency_ms: Date.now() - start,
      message: err instanceof Error ? err.message : 'unknown',
    }
  }
}

export async function GET() {
  const [supabase, hubCs, googleCalendar] = await Promise.all([
    checkSupabase(),
    checkHubCs(),
    checkGoogleCalendar(),
  ])

  const services = [supabase, hubCs, googleCalendar]
  const failedCritical = services.filter((s) => s.status === 'fail')
  const allOk = failedCritical.length === 0

  if (failedCritical.length > 0) {
    logWarn('health', 'serviços com falha', {
      failed: failedCritical.map((s) => s.name),
    })
  }

  return NextResponse.json(
    {
      ok: allOk,
      services,
      ts: new Date().toISOString(),
    },
    { status: allOk ? 200 : 503 }
  )
}
