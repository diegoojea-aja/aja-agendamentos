'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface DropdownItem {
  label: string
  href?: string
  onClick?: () => void
  icon?: ReactNode
  external?: boolean
  destructive?: boolean
}

interface Props {
  trigger: ReactNode
  items: DropdownItem[]
  /** Posição: alinha à direita do botão por padrão. */
  align?: 'left' | 'right'
}

/**
 * Dropdown leve sem dependências. Fecha ao clicar fora e em Escape.
 * Itens podem ser links (next/Link) ou ações.
 */
export function Dropdown({ trigger, items, align = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <div onClick={() => setOpen((v) => !v)}>{trigger}</div>
      {open && (
        <div
          role="menu"
          className={`absolute z-30 mt-1.5 min-w-[180px] rounded-lg border border-white/[0.10] bg-zinc-950/95 backdrop-blur-md shadow-xl py-1 ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item, i) => {
            const className = `flex items-center gap-2.5 w-full text-left px-3 py-2 text-[13px] transition-colors ${
              item.destructive
                ? 'text-rose-300 hover:bg-rose-500/10'
                : 'text-zinc-200 hover:bg-white/[0.06]'
            }`
            const content = (
              <>
                {item.icon && <span className="flex-shrink-0 text-zinc-500">{item.icon}</span>}
                <span className="flex-1">{item.label}</span>
              </>
            )
            if (item.href) {
              return (
                <a
                  key={i}
                  href={item.href}
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noopener noreferrer' : undefined}
                  onClick={() => setOpen(false)}
                  className={className}
                  role="menuitem"
                >
                  {content}
                </a>
              )
            }
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  item.onClick?.()
                  setOpen(false)
                }}
                className={className}
                role="menuitem"
              >
                {content}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
