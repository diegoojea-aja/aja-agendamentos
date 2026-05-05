import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Em contextos restritos (iframe cross-origin, modo privado, Brave paranóico)
 * `window.sessionStorage` e `window.localStorage` LANÇAM ao ser acessados,
 * antes de qualquer método. O supabase-js usa `window.sessionStorage`
 * internamente pro PKCE flow e quebra só de importar.
 *
 * Fix: substituir por stubs em memória quando inacessíveis, ANTES do
 * createClient rodar.
 */
if (typeof window !== 'undefined') {
  const memStore = (): Storage => {
    const m = new Map<string, string>()
    return {
      getItem: (k) => (m.has(k) ? m.get(k)! : null),
      setItem: (k, v) => { m.set(k, String(v)) },
      removeItem: (k) => { m.delete(k) },
      clear: () => { m.clear() },
      key: (i) => [...m.keys()][i] ?? null,
      get length() { return m.size },
    } as Storage
  }

  const probe = (name: 'sessionStorage' | 'localStorage') => {
    try {
      window[name].getItem('__probe__')
    } catch {
      try {
        Object.defineProperty(window, name, {
          value: memStore(),
          configurable: true,
          writable: false,
        })
      } catch {
        /* se nem defineProperty funcionar, desistimos silenciosamente */
      }
    }
  }

  probe('sessionStorage')
  probe('localStorage')

  // Mesmo com polyfill + flowType:'implicit', o auto-refresh de token e o
  // listener de auth-state ainda batem em algumas APIs restritas do browser
  // (BroadcastChannel, locks, etc.) e estouram como unhandled rejection
  // SecurityError. Não vaza pra UI nem trava nada — silenciamos só esse caso.
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason as { name?: string; message?: string } | null
    if (
      reason &&
      (reason.name === 'SecurityError' ||
        (typeof reason.message === 'string' && reason.message.includes('SecurityError')))
    ) {
      event.preventDefault()
    }
  })
}

const safeStorage = {
  getItem: (key: string): string | null => {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : null
    } catch {
      return null
    }
  },
  setItem: (key: string, value: string): void => {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
    } catch { /* noop */ }
  },
  removeItem: (key: string): void => {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key)
    } catch { /* noop */ }
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: safeStorage,
    persistSession: true,
    autoRefreshToken: true,
    flowType: 'implicit', // evita PKCE (que usa sessionStorage direto)
  },
})
