import { NextRequest, NextResponse } from 'next/server'
import { getUserProfile } from '@/lib/auth-helpers'

export const dynamic = 'force-dynamic'

/**
 * GET /api/me
 *
 * Retorna o profile do usuário autenticado (id, email, name, role, active).
 * Usado pra decidir redirect pós-login (admin → /admin, sdr → /sdr, closer → /closer).
 */
export async function GET(request: NextRequest) {
  const profile = await getUserProfile(request)
  if (!profile) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  }
  return NextResponse.json(profile)
}
