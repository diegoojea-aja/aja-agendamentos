'use client'

import { useEffect, useMemo, useState } from 'react'
import { authFetch } from '@/lib/api-client'
import {
  Check,
  Loader2,
  Minus,
  Plus,
  RotateCw,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'

type Bucket = 'Muito Qualificado' | 'Qualificado' | 'Neutro' | 'Semi Desqualificado' | 'Sem score'

interface CloserDist {
  id: string
  name: string
  slug: string
  email: string
  weight: number
  accepts_scores: string[]
  accepts_products: string[]
  last_assigned_at: string | null
  total: number
  by_bucket: Record<Bucket, number>
}

interface SimulationEntry {
  closer_id: string
  closer_name: string
  reason: string
}

interface RoutingPayload {
  rolling_window_days: number
  countable_statuses: string[]
  buckets: Bucket[]
  closers: CloserDist[]
  simulation: Record<string, SimulationEntry | null>
}

const BUCKET_STYLES: Record<Bucket, string> = {
  'Muito Qualificado': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'Qualificado': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'Neutro': 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  'Semi Desqualificado': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  'Sem score': 'bg-zinc-700/20 text-zinc-500 border-white/[0.06]',
}

const BUCKET_SHORT: Record<Bucket, string> = {
  'Muito Qualificado': 'Muito Q',
  'Qualificado': 'Qualif',
  'Neutro': 'Neutro',
  'Semi Desqualificado': 'Semi',
  'Sem score': 'Sem score',
}

export default function ConfiguracoesRoteamentoPage() {
  const [data, setData] = useState<RoutingPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pendingUpdates, setPendingUpdates] = useState<Set<string>>(new Set())

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await authFetch('/api/schedule/admin/routing')
      const payload = await res.json()
      if (!res.ok) {
        setError(payload.error || 'Erro ao carregar')
        return
      }
      setData(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  async function updateCloser(closer_id: string, body: { weight?: number; accepts_scores?: string[] }) {
    setPendingUpdates((prev) => new Set(prev).add(closer_id))
    try {
      const res = await authFetch('/api/schedule/admin/routing', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ closer_id, ...body }),
      })
      const payload = await res.json()
      if (!res.ok) throw new Error(payload.error || 'Erro')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setPendingUpdates((prev) => {
        const next = new Set(prev)
        next.delete(closer_id)
        return next
      })
    }
  }

  function toggleBucket(closer: CloserDist, bucket: Bucket) {
    const allBuckets = data?.buckets || []
    const current = closer.accepts_scores || []
    let next: string[]
    if (current.length === 0) {
      // Aceitava todos → desmarcar este = lista todos menos esse
      next = allBuckets.filter((b) => b !== bucket)
    } else if (current.includes(bucket)) {
      next = current.filter((b) => b !== bucket)
    } else {
      next = [...current, bucket]
      // Se cobriu todos, normaliza pra [] (= aceita todos)
      if (next.length === allBuckets.length) next = []
    }
    updateCloser(closer.id, { accepts_scores: next })
  }

  function adjustWeight(closer: CloserDist, delta: number) {
    const next = Math.max(0, Math.min(10, closer.weight + delta))
    if (next === closer.weight) return
    updateCloser(closer.id, { weight: next })
  }

  const totalsByBucket = useMemo(() => {
    if (!data) return {} as Record<Bucket, number>
    const totals = {} as Record<Bucket, number>
    for (const bucket of data.buckets) {
      totals[bucket] = data.closers.reduce((acc, c) => acc + (c.by_bucket[bucket] || 0), 0)
    }
    return totals
  }, [data])

  const grandTotal = useMemo(
    () => (data ? data.closers.reduce((acc, c) => acc + c.total, 0) : 0),
    [data]
  )

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-12 text-center text-zinc-500 text-sm">
        <Loader2 size={15} className="animate-spin inline mr-2" />
        Carregando
      </main>
    )
  }

  if (error || !data) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-6 text-rose-300 text-sm">
          {error || 'Erro ao carregar'}
        </div>
      </main>
    )
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-6 space-y-6 relative z-10">
      {/* Como funciona */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-violet-500/15 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <Target size={16} className="text-violet-300" />
          </div>
          <div>
            <h2 className="text-[15px] font-semibold text-white">Como funciona o roteamento</h2>
            <p className="text-[12.5px] text-zinc-400 mt-0.5">
              Balanceia carga total e mix de qualificação entre as closers, com regras configuráveis aqui.
            </p>
          </div>
        </div>

        <ol className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12.5px] text-zinc-300">
          <li className="flex gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <span className="text-zinc-500 font-mono">1.</span>
            Filtra closers ativas com peso &gt; 0, livres no horário e que <strong>aceitam o score</strong> e o funil do lead.
          </li>
          <li className="flex gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <span className="text-zinc-500 font-mono">2.</span>
            Conta bookings dos <strong>últimos {data.rolling_window_days} dias</strong> por closer (status: {data.countable_statuses.join(', ')}).
          </li>
          <li className="flex gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <span className="text-zinc-500 font-mono">3.</span>
            Escolhe quem tem <strong>menos leads desse score</strong> (normalizado pelo peso).
          </li>
          <li className="flex gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <span className="text-zinc-500 font-mono">4.</span>
            Empate? Quem tem <strong>menos leads totais</strong> (também normalizado).
          </li>
          <li className="flex gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <span className="text-zinc-500 font-mono">5.</span>
            Empate? Quem foi <strong>escolhida há mais tempo</strong> (round-robin determinístico).
          </li>
          <li className="flex gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
            <span className="text-zinc-500 font-mono">6.</span>
            Lead sem rótulo de score conta como bucket próprio &quot;Sem score&quot;.
          </li>
        </ol>
      </section>

      {/* Simulação */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
              <Sparkles size={14} className="text-amber-300" />
              Próximo lead vai pra…
            </h2>
            <p className="text-[12px] text-zinc-500 mt-0.5">
              Simulação baseada na carga atual (sem considerar disponibilidade de horário).
            </p>
          </div>
          <button
            onClick={load}
            className="text-[12px] text-zinc-400 hover:text-white flex items-center gap-1.5"
          >
            <RotateCw size={12} />
            Atualizar
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {data.buckets.map((bucket) => {
            const sim = data.simulation[bucket]
            return (
              <div
                key={bucket}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <span className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${BUCKET_STYLES[bucket]}`}>
                  {BUCKET_SHORT[bucket]}
                </span>
                {sim ? (
                  <>
                    <p className="text-[14px] text-white font-semibold mt-2">{sim.closer_name}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">{sim.reason}</p>
                  </>
                ) : (
                  <p className="text-[12px] text-rose-400 mt-2">
                    Nenhuma closer aceita esse bucket.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* Distribuição últimos 30d + matriz inline */}
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
        <div className="px-6 py-5 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-white flex items-center gap-2">
              <Users size={14} className="text-zinc-400" />
              Distribuição últimos {data.rolling_window_days} dias
            </h2>
            <p className="text-[12px] text-zinc-500 mt-0.5">
              {grandTotal} agendamentos contabilizados · clique nos buckets pra alterar elegibilidade.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-white/[0.06] text-[10px] uppercase tracking-wider text-zinc-500">
                <th className="text-left px-6 py-3 font-semibold">Closer</th>
                {data.buckets.map((b) => (
                  <th key={b} className="text-center px-2 py-3 font-semibold">
                    {BUCKET_SHORT[b]}
                  </th>
                ))}
                <th className="text-center px-3 py-3 font-semibold">Total</th>
                <th className="text-center px-3 py-3 font-semibold">Peso</th>
              </tr>
            </thead>
            <tbody>
              {data.closers.map((c) => {
                const isPending = pendingUpdates.has(c.id)
                const acceptsAll = c.accepts_scores.length === 0
                return (
                  <tr key={c.id} className={`border-b border-white/[0.04] ${isPending ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-white/[0.08] flex items-center justify-center text-[12px] font-semibold text-white">
                          {c.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-[13px] font-medium text-white">{c.name}</p>
                          <p className="text-[11px] text-zinc-500">
                            {c.weight === 0 ? 'pausada' : acceptsAll ? 'aceita todos' : `aceita ${c.accepts_scores.length}/${data.buckets.length}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    {data.buckets.map((b) => {
                      const accepts = acceptsAll || c.accepts_scores.includes(b)
                      const count = c.by_bucket[b] || 0
                      return (
                        <td key={b} className="text-center px-2 py-3">
                          <button
                            disabled={isPending}
                            onClick={() => toggleBucket(c, b)}
                            title={accepts ? `Clique pra parar de receber "${b}"` : `Clique pra aceitar "${b}"`}
                            className={`inline-flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg border transition-colors min-w-[52px] ${
                              accepts
                                ? 'border-white/[0.14] bg-white/[0.04] hover:bg-white/[0.08]'
                                : 'border-white/[0.04] bg-transparent text-zinc-600 hover:text-zinc-400 line-through opacity-50'
                            }`}
                          >
                            <span className="text-[14px] font-semibold tabular text-white">{count}</span>
                            {accepts && (
                              <Check size={9} className="text-emerald-400/80" />
                            )}
                          </button>
                        </td>
                      )
                    })}
                    <td className="text-center px-3 py-3">
                      <span className="text-[16px] font-semibold tabular text-white">{c.total}</span>
                      {grandTotal > 0 && (
                        <p className="text-[10px] text-zinc-500 mt-0.5">
                          {Math.round((c.total / grandTotal) * 100)}%
                        </p>
                      )}
                    </td>
                    <td className="text-center px-3 py-3">
                      <div className="inline-flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-white/[0.02]">
                        <button
                          disabled={isPending || c.weight <= 0}
                          onClick={() => adjustWeight(c, -1)}
                          className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/[0.06] rounded-l-lg disabled:opacity-30 transition-colors"
                        >
                          <Minus size={11} />
                        </button>
                        <span className="px-2 text-[14px] font-semibold tabular text-white min-w-[28px] text-center">
                          {c.weight}
                        </span>
                        <button
                          disabled={isPending || c.weight >= 10}
                          onClick={() => adjustWeight(c, 1)}
                          className="p-1.5 text-zinc-500 hover:text-white hover:bg-white/[0.06] rounded-r-lg disabled:opacity-30 transition-colors"
                        >
                          <Plus size={11} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-white/[0.06] text-[11px] text-zinc-500">
                <td className="px-6 py-3 font-semibold uppercase tracking-wider">Total</td>
                {data.buckets.map((b) => (
                  <td key={b} className="text-center px-2 py-3 font-semibold tabular text-zinc-300">
                    {totalsByBucket[b] || 0}
                  </td>
                ))}
                <td className="text-center px-3 py-3 font-semibold tabular text-zinc-300">{grandTotal}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="px-6 py-3 border-t border-white/[0.06] bg-white/[0.01] text-[11px] text-zinc-600">
          Peso 0 = closer pausada (não recebe agendamentos). Peso 2 = recebe ~2x o volume da média.
          Bucket riscado = closer não aceita esse tipo de lead.
        </div>
      </section>
    </main>
  )
}
