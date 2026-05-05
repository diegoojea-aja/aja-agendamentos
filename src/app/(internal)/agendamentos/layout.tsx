'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { authFetch } from '@/lib/api-client'
import {
  BarChart3,
  CalendarDays,
  ListChecks,
  Plus,
  Settings,
  Users,
} from 'lucide-react'

type Role = 'admin' | 'sdr' | 'closer' | 'comercial' | 'cs' | 'eventos'

interface Profile {
  id: string
  name: string | null
  email: string
  role: Role
}

interface NavItem {
  href: string
  label: string
  icon: typeof BarChart3
  roles: Role[]
}

const NAV: NavItem[] = [
  { href: '/agendamentos', label: 'Visão geral', icon: BarChart3, roles: ['admin'] },
  { href: '/agendamentos/meus', label: 'Meus agendamentos', icon: ListChecks, roles: ['sdr', 'closer'] },
  { href: '/agendamentos/novo', label: 'Novo', icon: Plus, roles: ['admin', 'sdr'] },
  { href: '/agendamentos/calendario', label: 'Calendário', icon: CalendarDays, roles: ['admin'] },
  { href: '/agendamentos/closers', label: 'Closers', icon: Users, roles: ['admin'] },
  { href: '/agendamentos/configuracoes', label: 'Configurações', icon: Settings, roles: ['admin'] },
]

/**
 * Sub-layout do ambiente Agendamentos. Renderizado dentro do AppShell
 * (que cuida do sidebar global), então só adiciona o sub-nav de tabs
 * locais e o título da seção.
 */
export default function AgendamentosLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch('/api/me')
        if (!res.ok) {
          router.replace('/login')
          return
        }
        const data = await res.json()
        if (!cancelled) setProfile(data)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  // Admin enxerga tudo. Outros roles só veem o que está liberado pra eles.
  const visibleNav = NAV.filter(
    (item) => profile && (profile.role === 'admin' || item.roles.includes(profile.role))
  )

  const subtitle =
    profile?.role === 'admin'
      ? 'Distribuição, agendas e regras'
      : profile?.role === 'sdr'
        ? 'Acompanhe os agendamentos que você criou'
        : profile?.role === 'closer'
          ? 'Suas reuniões e marcação de status'
          : null

  return (
    <>
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/60 border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-6 py-3.5">
          <h1 className="text-[15px] font-semibold tracking-tight">Agendamentos</h1>
          {subtitle && (
            <p className="text-[12px] text-zinc-500">{subtitle}</p>
          )}
        </div>

        {!loading && visibleNav.length > 0 && (
          <nav className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
            {visibleNav.map((item) => {
              const Icon = item.icon
              const active =
                item.href === '/agendamentos'
                  ? pathname === '/agendamentos'
                  : pathname.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-1.5 px-3 py-2.5 text-[13px] transition-colors whitespace-nowrap ${
                    active ? 'text-white' : 'text-zinc-500 hover:text-zinc-200'
                  }`}
                >
                  <Icon size={13} />
                  {item.label}
                  {active && (
                    <span className="absolute left-0 right-0 -bottom-px h-px bg-white" />
                  )}
                </Link>
              )
            })}
          </nav>
        )}
      </header>

      {loading ? (
        <div className="max-w-6xl mx-auto px-6 py-12 text-center text-zinc-500 text-sm">
          Carregando
        </div>
      ) : (
        children
      )}
    </>
  )
}
