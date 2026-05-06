'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { authFetch } from '@/lib/api-client'
import { DarkShell } from '@/components/ui/DarkShell'
import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  LogOut,
  Menu,
  Plus,
  Target,
  Users as UsersIcon,
  X,
} from 'lucide-react'

type Role = 'admin' | 'sdr' | 'comercial' | 'cs' | 'eventos' | 'closer'
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
  roles: Role[] | 'all'
  matcher?: (pathname: string) => boolean
}

interface NavSection {
  label: string
  items: NavItem[]
}

const NAV: NavSection[] = [
  {
    label: 'Principal',
    items: [
      {
        href: '/agendamentos',
        label: 'Visão geral',
        icon: BarChart3,
        roles: ['admin'],
        matcher: (p) => p === '/agendamentos',
      },
      {
        href: '/agendamentos/meus',
        label: 'Meus',
        icon: ListChecks,
        roles: ['sdr', 'closer'],
      },
      {
        href: '/agendamentos/novo',
        label: 'Novo',
        icon: Plus,
        roles: ['admin', 'sdr'],
      },
      {
        href: '/agendamentos/calendario',
        label: 'Calendário',
        icon: CalendarDays,
        roles: ['admin'],
      },
    ],
  },
  {
    label: 'Gestão',
    items: [
      {
        href: '/agendamentos/closers',
        label: 'Closers',
        icon: UsersIcon,
        roles: ['admin'],
      },
      {
        href: '/agendamentos/configuracoes',
        label: 'Roteamento',
        icon: Target,
        roles: ['admin'],
      },
    ],
  },
  {
    label: 'Admin',
    items: [
      {
        href: '/admin/usuarios',
        label: 'Usuários',
        icon: UsersIcon,
        roles: ['admin'],
      },
    ],
  },
]

const COLLAPSED_KEY = 'aja-agendamentos-sidebar-collapsed'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(COLLAPSED_KEY)
    if (stored === '1') setCollapsed(true)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0')
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [mobileOpen])

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

  async function handleLogout() {
    await supabase.auth.signOut()
    // Limpa cookie do Supabase Auth (ajustar conforme project_ref do Supabase novo)
    document.cookie = document.cookie
      .split(';')
      .map((c) => c.trim())
      .filter((c) => c.startsWith('sb-') && c.includes('auth-token'))
      .map((c) => c.split('=')[0])
      .reduce((_, name) => {
        document.cookie = `${name}=; path=/; max-age=0`
        return ''
      }, '')
    router.push('/login')
  }

  const role = profile?.role
  const visibleSections = NAV
    .map((section) => ({
      ...section,
      items: section.items.filter(
        (n) => !role || n.roles === 'all' || n.roles.includes(role)
      ),
    }))
    .filter((section) => section.items.length > 0)

  const sidebarWidth = collapsed ? 'w-16' : 'w-60'

  function NavItemRow({ item }: { item: NavItem }) {
    const Icon = item.icon
    const active = item.matcher ? item.matcher(pathname) : pathname.startsWith(item.href)
    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] transition-colors ${
          active
            ? 'bg-white/[0.06] text-white'
            : 'text-zinc-400 hover:text-white hover:bg-white/[0.03]'
        }`}
      >
        {active && (
          <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r bg-white" aria-hidden />
        )}
        <Icon size={16} className="flex-shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    )
  }

  return (
    <DarkShell>
      {/* Mobile top bar */}
      <div className="md:hidden sticky top-0 z-40 backdrop-blur-xl bg-black/60 border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu"
          className="p-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <Menu size={18} />
        </button>
        <span className="text-[13px] font-semibold tracking-tight text-white">
          AJA Agendamentos
        </span>
        <button
          onClick={handleLogout}
          aria-label="Sair"
          className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <LogOut size={15} />
        </button>
      </div>

      <div className="flex min-h-screen">
        {mobileOpen && (
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <aside
          className={`${
            mobileOpen
              ? 'fixed inset-y-0 left-0 w-64 z-50 translate-x-0'
              : 'fixed inset-y-0 left-0 w-64 z-50 -translate-x-full md:translate-x-0'
          } md:sticky md:top-0 md:h-screen md:${sidebarWidth} ${sidebarWidth} flex flex-col border-r border-white/[0.06] bg-black/40 backdrop-blur-xl transition-[width,transform] duration-200`}
        >
          <div className="px-4 py-4 flex items-center justify-between border-b border-white/[0.04]">
            {!collapsed ? (
              <Link href="/" className="flex items-center gap-2">
                <span className="text-white text-[14px] font-semibold tracking-tight">AJA</span>
                <span className="text-zinc-500 text-[10px] font-medium uppercase tracking-wider bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
                  Agendamentos
                </span>
              </Link>
            ) : (
              <Link href="/" className="text-white text-[14px] font-semibold mx-auto">
                A
              </Link>
            )}

            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Fechar menu"
              className="md:hidden p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <X size={16} />
            </button>

            <button
              onClick={() => setCollapsed((v) => !v)}
              aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
              title={collapsed ? 'Expandir' : 'Recolher'}
              className="hidden md:inline-flex p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </button>
          </div>

          <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {!loading && visibleSections.map((section, idx) => (
              <div key={section.label} className={idx > 0 ? 'pt-3' : ''}>
                <div className={`pb-1.5 px-3 text-[10px] uppercase tracking-[0.14em] text-zinc-600 font-semibold ${collapsed ? 'sr-only' : ''}`}>
                  {section.label}
                </div>
                {section.items.map((item) => (
                  <NavItemRow key={item.href} item={item} />
                ))}
              </div>
            ))}
          </nav>

          <div className="border-t border-white/[0.04] p-3">
            {!collapsed ? (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.08] flex items-center justify-center text-[13px] font-semibold text-white flex-shrink-0">
                  {(profile?.name || profile?.email || '?').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium text-white truncate">
                    {profile?.name || '—'}
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate capitalize">{role || ''}</p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sair"
                  aria-label="Sair"
                  className="p-1.5 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                >
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLogout}
                title="Sair"
                aria-label="Sair"
                className="w-full p-2 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors flex justify-center"
              >
                <LogOut size={15} />
              </button>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 relative z-10">
          {children}
        </main>
      </div>
    </DarkShell>
  )
}
