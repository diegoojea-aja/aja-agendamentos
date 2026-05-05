'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Lock, Mail, Eye, EyeOff, ArrowRight } from 'lucide-react'
import { DarkShell } from '@/components/ui/DarkShell'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      const msg =
        error.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : 'Não foi possível fazer login. Tente novamente.'
      setError(msg)
      setLoading(false)
      return
    }

    // Cookie do Supabase Auth — nome depende do project_ref. Extraímos da URL
    // do Supabase pra não hardcodar (e funcionar mesmo se trocar de project).
    if (data.session) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
      const ref = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1]
      if (ref) {
        document.cookie = `sb-${ref}-auth-token=${data.session.access_token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
      }
    }

    // Redireciona pra rota certa baseado no role.
    // - sdr/closer → /agendamentos/meus (agenda pessoal)
    // - admin/cs/comercial/eventos → /agendamentos (hub)
    let destination = '/agendamentos'
    try {
      const meRes = await fetch('/api/me', {
        headers: { Authorization: `Bearer ${data.session?.access_token}` },
      })
      if (meRes.ok) {
        const me = await meRes.json()
        if (me.role === 'sdr' || me.role === 'closer') destination = '/agendamentos/meus'
      }
    } catch {
      // Fallback pro /agendamentos
    }

    router.push(destination)
  }

  return (
    <DarkShell>
      <main className="flex-1 flex items-center justify-center px-6 py-12 relative z-10">
        <div className="w-full max-w-sm hero-enter">
          {/* Wordmark */}
          <div className="text-center mb-10">
            <h1 className="wordmark text-4xl sm:text-5xl leading-[0.92] mb-3">
              AJA FORMS
            </h1>
            <p className="text-[13px] text-zinc-500">Painel administrativo</p>
          </div>

          {/* Card */}
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-7">
            <div className="mb-6">
              <h2 className="text-lg font-semibold tracking-tight text-white">
                Entrar
              </h2>
              <p className="text-[13px] text-zinc-500 mt-1">
                Use suas credenciais de administrador
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-[12px] uppercase tracking-wider font-semibold text-zinc-500 mb-1.5">
                  E-mail
                </label>
                <div className="relative">
                  <Mail
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="seu@email.com"
                    className="w-full pl-10 pr-3 py-2.5 rounded-xl text-sm text-white bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] uppercase tracking-wider font-semibold text-zinc-500 mb-1.5">
                  Senha
                </label>
                <div className="relative">
                  <Lock
                    size={15}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
                  />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm text-white bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-violet-500/40 focus:border-violet-500/60 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-3">
                  <p className="text-rose-400 text-sm">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 bg-white text-black rounded-xl text-sm font-semibold hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 mt-6"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    Entrando
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-[11px] text-zinc-700 mt-6">
            AJA Educação
          </p>
        </div>
      </main>
    </DarkShell>
  )
}
