'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authFetch } from '@/lib/api-client'
import {
  Calendar,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  ExternalLink,
  TrendingUp,
  AlertTriangle,
  Tag,
} from 'lucide-react'
import {
  BookingStatusModal,
  STATUS_STYLES,
  type BookingStatus,
} from '@/components/admin/BookingStatusModal'

const SCORE_STYLES: Record<string, string> = {
  'Muito Qualificado': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  'Qualificado': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  'Neutro': 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  'Semi Desqualificado': 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

interface CloserDist {
  id: string
  name: string
  slug: string
  active: boolean
  bookings_month: number
  bookings_total_hours: number
}

interface Booking {
  id: string
  closer_id: string
  closer_name: string
  closer_slug: string
  lead_name: string
  lead_email: string | null
  lead_phone: string | null
  zoho_id: string | null
  sdr_name: string | null
  sdr_note: string | null
  lead_score: string | null
  lead_registered_at: string | null
  funnel: string | null
  observations: string | null
  date: string
  time_start: string
  time_end: string
  duration: number
  status: string
  google_event_id: string | null
  meet_link: string | null
  created_at: string
}

const ZOHO_LEAD_URL = (id: string) =>
  `https://one.zoho.com/zohoone/ajacomosejafosse/home/cxapp/crm/org836031329/tab/Potentials/${id}`

interface Stats {
  today: number
  this_week: number
  this_month: number
  is_balanced: boolean
  balance_gap: number
}

const CLOSER_COLORS = [
  { bg: 'bg-blue-500', bar: 'bg-blue-500', text: 'text-blue-400', ring: 'ring-blue-500/30' },
  { bg: 'bg-violet-500', bar: 'bg-violet-500', text: 'text-violet-400', ring: 'ring-violet-500/30' },
  { bg: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
  { bg: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-400', ring: 'ring-amber-500/30' },
  { bg: 'bg-rose-500', bar: 'bg-rose-500', text: 'text-rose-400', ring: 'ring-rose-500/30' },
]

export default function AgendamentosPage() {
  const router = useRouter()
  const [stats, setStats] = useState<Stats | null>(null)
  const [distribution, setDistribution] = useState<CloserDist[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [maxBookings, setMaxBookings] = useState(1)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'upcoming' | 'past'>('upcoming')
  const [statusBooking, setStatusBooking] = useState<Booking | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Visão geral é admin-only — sdr/closer caem em /meus.
      try {
        const meRes = await authFetch('/api/me')
        if (!meRes.ok) {
          router.replace('/login')
          return
        }
        const me = await meRes.json()
        if (me.role !== 'admin') {
          router.replace('/agendamentos/meus')
          return
        }
      } catch {
        router.replace('/login')
        return
      }

      const r = await authFetch('/api/schedule/admin/stats')
      const data = await r.json()
      if (cancelled) return
      setStats(data.stats)
      setDistribution(data.distribution)
      setBookings(data.bookings)
      setMaxBookings(data.max_bookings)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  const todayStr = new Date().toLocaleDateString('sv-SE')
  const filteredBookings = bookings.filter((b) => {
    if (filter === 'upcoming') return b.date >= todayStr && b.status === 'confirmed'
    if (filter === 'past') return b.date < todayStr || b.status !== 'confirmed'
    return true
  })

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-20">
        <p className="text-zinc-500 text-sm">Carregando</p>
      </div>
    )
  }

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 pt-6 flex items-center justify-end gap-2">
        <Link
          href="/agendamentos/novo"
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-lg text-[13px] font-semibold hover:bg-zinc-200 transition-colors"
        >
          <Calendar size={13} />
          Novo agendamento
        </Link>
      </div>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6 relative z-10">
        {/* Stats cards: 3 numéricos consistentes */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="Hoje" value={stats?.today || 0} icon={<Clock size={15} />} />
          <StatCard label="Esta semana" value={stats?.this_week || 0} icon={<Calendar size={15} />} />
          <StatCard label="Este mês" value={stats?.this_month || 0} icon={<TrendingUp size={15} />} />
        </div>

        {/* Banner de equilíbrio: status textual cabe melhor em uma linha */}
        <div
          className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${
            stats?.is_balanced
              ? 'border-emerald-500/20 bg-emerald-500/[0.05]'
              : 'border-amber-500/20 bg-amber-500/[0.05]'
          }`}
        >
          {stats?.is_balanced ? (
            <CheckCircle2 size={15} className="text-emerald-400 flex-shrink-0" />
          ) : (
            <AlertTriangle size={15} className="text-amber-400 flex-shrink-0" />
          )}
          <p
            className={`text-[13px] flex-1 ${
              stats?.is_balanced ? 'text-emerald-200' : 'text-amber-200'
            }`}
          >
            <strong className="font-semibold">
              {stats?.is_balanced ? 'Balanceado' : `${stats?.balance_gap} de diferença`}
            </strong>
            <span className="text-zinc-400 ml-2">
              {stats?.is_balanced
                ? '· diferença ≤ 3 entre closers'
                : '· próximos agendamentos priorizarão quem tem menos'}
            </span>
          </p>
        </div>

        {/* Distribution */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500 flex items-center gap-2">
              <Users size={13} />
              Distribuição do mês
            </h2>
            <span className="text-[12px] text-zinc-500 tabular">
              {distribution.reduce((s, d) => s + d.bookings_month, 0)} agendamentos
            </span>
          </div>

          <div className="space-y-4">
            {distribution.map((closer, i) => {
              const color = CLOSER_COLORS[i % CLOSER_COLORS.length]
              const pct = maxBookings > 0 ? (closer.bookings_month / maxBookings) * 100 : 0
              const totalPct = distribution.reduce((s, d) => s + d.bookings_month, 0)
              const sharePct = totalPct > 0 ? Math.round((closer.bookings_month / totalPct) * 100) : 0

              return (
                <div key={closer.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2.5">
                      <div className={`w-8 h-8 rounded-lg ${color.bg} flex items-center justify-center text-white text-[13px] font-semibold`}>
                        {closer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{closer.name}</p>
                        <p className="text-[11px] text-zinc-500">
                          {closer.bookings_total_hours}h agendadas · {sharePct}% do total
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-2xl font-semibold tabular ${color.text}`}>
                        {closer.bookings_month}
                      </p>
                      <p className="text-[10px] text-zinc-600 uppercase tracking-wider">
                        {closer.bookings_month === 1 ? 'agendamento' : 'agendamentos'}
                      </p>
                    </div>
                  </div>
                  <div className="w-full bg-white/[0.06] rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${color.bar} transition-all duration-500`}
                      style={{ width: `${Math.max(pct, 2)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Bookings list */}
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500">
              Agendamentos
            </h2>
            <div className="flex bg-white/[0.02] border border-white/[0.08] rounded-lg p-0.5">
              {(['upcoming', 'past', 'all'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 text-[12px] rounded-md transition-colors ${
                    filter === f
                      ? 'bg-white text-black font-semibold'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {f === 'upcoming' ? 'Próximos' : f === 'past' ? 'Passados' : 'Todos'}
                </button>
              ))}
            </div>
          </div>

          {filteredBookings.length === 0 ? (
            <p className="text-zinc-500 text-sm text-center py-10">
              Nenhum agendamento {filter === 'upcoming' ? 'próximo' : filter === 'past' ? 'passado' : ''}.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {filteredBookings.map((b, i) => {
                const closerIdx = distribution.findIndex((d) => d.id === b.closer_id)
                const color = CLOSER_COLORS[closerIdx >= 0 ? closerIdx % CLOSER_COLORS.length : 0]
                const isToday = b.date === todayStr
                const isPast = b.date < todayStr

                return (
                  <div
                    key={b.id}
                    className={`px-5 py-4 hover:bg-white/[0.02] transition-colors ${isPast ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        {/* Closer avatar */}
                        <div className={`w-9 h-9 rounded-lg ${color.bg} flex items-center justify-center text-white text-[13px] font-semibold flex-shrink-0 mt-0.5`}>
                          {b.closer_name.charAt(0)}
                        </div>

                        <div className="min-w-0">
                          {/* Lead name + closer */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium text-white">{b.lead_name}</p>
                            <span className="text-[10px] text-zinc-500">→</span>
                            <span className={`text-[12px] font-medium ${color.text}`}>
                              {b.closer_name}
                            </span>
                          </div>

                          {/* Date + time */}
                          <div className="flex items-center gap-3 mt-1 text-[12px] text-zinc-400">
                            <span className="tabular">
                              {isToday ? 'Hoje' : new Date(b.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                                weekday: 'short', day: 'numeric', month: 'short',
                              })}
                            </span>
                            <span className="tabular">{b.time_start} — {b.time_end}</span>
                            <span>{b.duration} min</span>
                          </div>

                          {/* Lead details */}
                          <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500 flex-wrap">
                            {b.funnel && (
                              <span className="bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded">
                                {b.funnel}
                              </span>
                            )}
                            {b.zoho_id && (
                              <a
                                href={ZOHO_LEAD_URL(b.zoho_id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-zinc-400 hover:text-emerald-300 transition-colors"
                                title="Abrir no Zoho CRM"
                              >
                                Zoho
                                <ExternalLink size={10} />
                              </a>
                            )}
                            {b.lead_score && (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-semibold ${
                                  SCORE_STYLES[b.lead_score] ||
                                  'bg-white/[0.04] text-zinc-300 border-white/[0.06]'
                                }`}
                              >
                                <Tag size={9} />
                                {b.lead_score}
                              </span>
                            )}
                            {b.sdr_name && (
                              <span className="text-zinc-400">
                                SDR: {b.sdr_name}
                              </span>
                            )}
                            {b.lead_phone && <span>{b.lead_phone}</span>}
                            {b.lead_email && <span className="truncate max-w-[200px]">{b.lead_email}</span>}
                          </div>

                          {/* Nota SDR / Observações */}
                          {(b.sdr_note || b.observations) && (
                            <p className="text-[11px] text-zinc-600 mt-1.5 line-clamp-2">
                              {b.sdr_note && <span className="text-zinc-500">Nota: </span>}
                              {b.sdr_note || b.observations}
                            </p>
                          )}
                          {/* Lead produto legado — só mostra se não tem os campos novos (backfill) */}
                          {!b.funnel && (b as Booking & { lead_produto?: string | null }).lead_produto && (
                            <span className="text-[10px] text-zinc-600 mt-1 inline-block">
                              Produto: {(b as Booking & { lead_produto?: string | null }).lead_produto}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right side: status + actions */}
                      <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                        <span
                          className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${
                            STATUS_STYLES[b.status as BookingStatus]?.cls ||
                            'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                          }`}
                        >
                          {STATUS_STYLES[b.status as BookingStatus]?.label || b.status}
                        </span>
                        <button
                          onClick={() => setStatusBooking(b)}
                          className="text-[11px] text-zinc-400 hover:text-white border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] px-2 py-0.5 rounded transition-colors"
                        >
                          Marcar status
                        </button>
                        {b.google_event_id ? (
                          <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                            <CheckCircle2 size={10} className="text-emerald-500" />
                            Google Calendar
                          </span>
                        ) : (
                          <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                            <XCircle size={10} className="text-zinc-600" />
                            Sem sync
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Link pra agendas individuais */}
        <div className="flex items-center gap-3 pt-2">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-600">
            Links diretos:
          </p>
          {distribution.map((c) => (
            <Link
              key={c.id}
              href={`/agendar/${c.slug}`}
              className="text-[12px] text-zinc-500 hover:text-white border border-white/[0.06] hover:border-white/[0.14] px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
            >
              {c.name} <ExternalLink size={10} />
            </Link>
          ))}
        </div>
      </main>

      {statusBooking && (
        <BookingStatusModal
          bookingId={statusBooking.id}
          leadName={statusBooking.lead_name}
          closerName={statusBooking.closer_name}
          closerSlug={statusBooking.closer_slug}
          date={statusBooking.date}
          timeStart={statusBooking.time_start}
          currentStatus={statusBooking.status as BookingStatus}
          leadData={{
            zoho_id: statusBooking.zoho_id,
            lead_email: statusBooking.lead_email,
            lead_phone: statusBooking.lead_phone,
            sdr_name: statusBooking.sdr_name,
            funnel: statusBooking.funnel,
          }}
          onClose={() => setStatusBooking(null)}
          onSaved={() => {
            setStatusBooking(null)
            // refetch
            fetch('/api/schedule/admin/stats')
              .then((r) => r.json())
              .then((data) => {
                setStats(data.stats)
                setDistribution(data.distribution)
                setBookings(data.bookings)
                setMaxBookings(data.max_bookings)
              })
              .catch(() => {})
          }}
        />
      )}
    </>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2 mb-2 text-zinc-500">
        {icon}
        <span className="text-[11px] uppercase tracking-[0.12em] font-semibold">{label}</span>
      </div>
      <p className="text-2xl font-semibold tracking-tight text-white tabular">{value}</p>
    </div>
  )
}
