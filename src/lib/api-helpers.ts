import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

// Get user ID from middleware header
export function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id')
}

// Require auth — return 401 if not authenticated
export function requireAuth(request: NextRequest): string {
  const userId = getUserId(request)
  if (!userId) throw new AuthError()
  return userId
}

export class AuthError extends Error {
  constructor() {
    super('Unauthorized')
  }
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (err instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Dados inválidos', details: err.issues },
      { status: 400 }
    )
  }
  const message = err instanceof Error ? err.message : 'Erro interno'
  console.error('[API Error]', err)
  return NextResponse.json({ error: message }, { status: 500 })
}

// Validate URL is safe (no SSRF)
export function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return false
    const hostname = parsed.hostname
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname === '::1' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('172.') ||
      hostname.startsWith('192.168.') ||
      hostname.startsWith('169.254.')
    ) {
      return false
    }
    return true
  } catch {
    return false
  }
}
