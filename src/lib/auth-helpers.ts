import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@/lib/supabase-server'

export type UserRole = 'admin' | 'sdr' | 'comercial' | 'cs' | 'eventos' | 'closer'

export interface UserProfile {
  id: string
  email: string
  name: string | null
  role: UserRole
  active: boolean
}

/**
 * Busca o profile do usuário autenticado (via x-user-id injetado no middleware).
 * Retorna null se não tiver user id ou profile.
 */
export async function getUserProfile(request: NextRequest): Promise<UserProfile | null> {
  const userId = request.headers.get('x-user-id')
  if (!userId) return null

  // Localhost bypass do middleware: trata como admin local
  if (userId === 'localhost-dev-user') {
    return {
      id: 'localhost-dev-user',
      email: 'dev@localhost',
      name: 'Dev (localhost)',
      role: 'admin',
      active: true,
    }
  }

  const supabase = createServerClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('id, email, name, role, active')
    .eq('id', userId)
    .maybeSingle()

  return data as UserProfile | null
}

/**
 * Valida que o usuário é admin. Lança erro se não for.
 */
export async function requireAdmin(request: NextRequest): Promise<UserProfile> {
  const profile = await getUserProfile(request)
  if (!profile) throw new Error('UNAUTHORIZED')
  if (!profile.active) throw new Error('INACTIVE_USER')
  if (profile.role !== 'admin') throw new Error('FORBIDDEN_NOT_ADMIN')
  return profile
}

/**
 * Valida o profile do usuário e exige que role esteja na lista de allowed.
 * Admin sempre passa. Lança erro se não for autorizado.
 */
export async function requireRole(
  request: NextRequest,
  allowed: UserRole[]
): Promise<UserProfile> {
  const profile = await getUserProfile(request)
  if (!profile) throw new Error('UNAUTHORIZED')
  if (!profile.active) throw new Error('INACTIVE_USER')
  if (profile.role !== 'admin' && !allowed.includes(profile.role)) {
    throw new Error('FORBIDDEN')
  }
  return profile
}

/**
 * Tenta extrair user id de um Bearer token na request, sem falhar se ausente.
 * Usado em rotas públicas que querem "registrar" um user id se autenticado
 * (ex: /api/schedule/[slug]/book grava sdr_user_id quando SDR logado).
 */
export async function getOptionalUserId(request: NextRequest): Promise<string | null> {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '').trim()
  if (!token) return null

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data } = await supabase.auth.getUser(token)
    return data.user?.id ?? null
  } catch {
    return null
  }
}
