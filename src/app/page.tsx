'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { authFetch } from '@/lib/api-client'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await authFetch('/api/me')
        if (!res.ok) {
          router.replace('/login')
          return
        }
        const me = await res.json()
        if (cancelled) return

        // Redirect role-aware: SDR/Closer caem em /meus, resto em hub admin.
        if (me.role === 'sdr' || me.role === 'closer') {
          router.replace('/agendamentos/meus')
        } else {
          router.replace('/agendamentos')
        }
      } catch {
        router.replace('/login')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500 text-sm">
      Carregando…
    </div>
  )
}
