import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const PROTECTED_ROUTES = ['/admin', '/agendamentos']
const PROTECTED_API = [
  '/api/sdr',
  '/api/closer',
  '/api/me',
  '/api/users',
  '/api/schedule',
]
// /api/cron usa CRON_SECRET (verificado dentro da rota); /api/health é público.
const PUBLIC_API: string[] = ['/api/cron', '/api/health']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Bypass auth on localhost — inject fake user id so downstream
  // requireAuth() in API routes passes through.
  const host = request.headers.get('host') || ''
  if (host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', 'localhost-dev-user')
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  if (PUBLIC_API.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  const needsAuth =
    PROTECTED_ROUTES.some((route) => pathname.startsWith(route)) ||
    PROTECTED_API.some((route) => pathname.startsWith(route))

  if (!needsAuth) return NextResponse.next()

  // Extract token from cookie or Authorization header.
  // Cookie name depende do project_ref do Supabase — varremos qualquer
  // sb-*-auth-token (independe do project, facilita troca de Supabase).
  const authHeader = request.headers.get('authorization')
  const cookieToken = request.cookies
    .getAll()
    .find((c) => c.name.startsWith('sb-') && c.name.endsWith('-auth-token'))?.value

  const token = authHeader?.replace('Bearer ', '') || cookieToken

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const response = NextResponse.next()
  response.headers.set('x-user-id', user.id)
  return response
}

export const config = {
  matcher: [
    '/admin',
    '/admin/:path*',
    '/agendamentos',
    '/agendamentos/:path*',
    '/api/sdr/:path*',
    '/api/closer/:path*',
    '/api/me',
    '/api/users/:path*',
    '/api/schedule/:path*',
  ],
}
