import { NextRequest, NextResponse } from 'next/server'

/**
 * Rate limit em memória por IP. Token bucket simples — cada IP tem
 * uma janela deslizante. Quando atinge o limite, retorna 429.
 *
 * Limitações:
 *   - In-memory: se o Vercel girar várias instâncias, cada uma tem seu
 *     próprio bucket. Pra AJA single-tenant com tráfego moderado, OK.
 *     Se virar problema, trocar pra Upstash Redis (já tem SDK pronto).
 *   - O Map cresce com o tempo. Limpamos entries velhas a cada chamada.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()
const CLEANUP_THRESHOLD = 1000

function getClientIp(request: NextRequest): string {
  // x-forwarded-for é o que Vercel/proxies usam. Pega o primeiro (cliente real).
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real
  return 'unknown'
}

function cleanup(now: number) {
  if (buckets.size < CLEANUP_THRESHOLD) return
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt < now) buckets.delete(key)
  }
}

export interface RateLimitOptions {
  limit: number
  windowMs: number
  keyPrefix?: string
}

/**
 * Tenta consumir 1 token. Retorna NextResponse 429 se exceder, ou null
 * se passou. Usa em rota assim:
 *
 *   const limited = checkRateLimit(request, { limit: 10, windowMs: 60_000 })
 *   if (limited) return limited
 */
export function checkRateLimit(
  request: NextRequest,
  options: RateLimitOptions
): NextResponse | null {
  const now = Date.now()
  const ip = getClientIp(request)
  const key = `${options.keyPrefix || 'default'}:${ip}`

  cleanup(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs })
    return null
  }

  if (bucket.count >= options.limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000)
    return NextResponse.json(
      { error: 'Muitas requisições. Tente novamente em alguns segundos.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(options.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(bucket.resetAt),
        },
      }
    )
  }

  bucket.count++
  return null
}
