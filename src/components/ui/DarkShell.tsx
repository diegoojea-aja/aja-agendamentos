'use client'

import { useEffect, useRef } from 'react'

interface Props {
  children: React.ReactNode
  className?: string
}

/**
 * Shell dark com efeitos atmosféricos do AJA Design System:
 * - aurora blobs animadas (3 camadas)
 * - grid overlay sutil no topo
 * - spotlight que segue o mouse
 * - noise cinemática por cima
 *
 * Use como wrapper raiz de qualquer página dark. Header/footer são
 * responsabilidade da página.
 */
export function DarkShell({ children, className }: Props) {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleMouseMove(e: MouseEvent) {
      if (!rootRef.current) return
      const x = (e.clientX / window.innerWidth) * 100
      const y = (e.clientY / window.innerHeight) * 100
      rootRef.current.style.setProperty('--mouse-x', `${x}%`)
      rootRef.current.style.setProperty('--mouse-y', `${y}%`)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div
      ref={rootRef}
      className={`min-h-screen flex flex-col bg-black relative overflow-x-hidden ${className || ''}`}
    >
      {/* Aurora blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
        <div className="aurora-blob aurora-3" />
      </div>
      <div className="absolute inset-0 bg-grid pointer-events-none" />
      <div className="spotlight" />
      <div className="noise-overlay" />

      {/* Children (header, main, footer — responsibility of the page) */}
      {children}
    </div>
  )
}
