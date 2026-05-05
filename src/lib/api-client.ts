import { supabase } from './supabase'

/**
 * fetch() que anexa o Authorization: Bearer <token> a partir da sessão atual
 * do supabase-js. Usado nas telas admin porque o middleware valida o token,
 * e nós guardamos a sessão em localStorage (não em cookie).
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers = new Headers(init.headers)
  if (token) headers.set('Authorization', `Bearer ${token}`)

  return fetch(input, { ...init, headers })
}
