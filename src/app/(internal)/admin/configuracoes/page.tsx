'use client'

import { Settings, Sparkles } from 'lucide-react'

export default function ConfiguracoesPage() {
  return (
    <main className="max-w-4xl mx-auto px-6 py-12 relative z-10">
      <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
        <div className="w-12 h-12 rounded-xl bg-white/[0.04] flex items-center justify-center mx-auto mb-4">
          <Settings size={20} className="text-zinc-400" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight text-white mb-2">
          Configurações do sistema
        </h2>
        <p className="text-zinc-400 text-sm max-w-md mx-auto mb-1">
          Configurações globais (envio de e-mail, domínios públicos, integrações
          do workspace, etc).
        </p>
        <p className="text-zinc-600 text-[13px] mt-3 inline-flex items-center gap-1.5">
          <Sparkles size={12} />
          Em construção
        </p>
      </div>
    </main>
  )
}
