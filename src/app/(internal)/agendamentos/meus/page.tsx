'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { authFetch } from '@/lib/api-client'
import {
  BookingStatusModal,
  STATUS_STYLES,
  type BookingStatus,
} from '@/components/admin/BookingStatusModal'
import {
  Calendar,
  Clock,
  Search,
  ExternalLink,
  Phone,
  Mail,
  Loader2,
  CircleDot,
  Plus,
} from 'lucide-react'

interface Booking {
  id: string
  closer_id?: string
  closer_name?: string
  closer_slug?: string
  lead_name: string
  lead_email: string | null
  lead_phone: string | null
  zoho_id: string | null
  sdr_name: string | null
  funnel: string | null
  observations?: string | null
  date: string
  time_start: string
  time_end: string
  duration: number
  status: string
  lost_reason: string | null
  meet_link: string | null
}

interface Closer {
  id: string
  name: string
  slug: string
  email: string
}

const ZOHO_LEAD_URL = (id: string) =>
  `https://one.zoho.com/zohoone/ajacomosejafosse/home/cxapp/crm/org836031329/tab/Potentials/${id}`

const TABS = [
  { id: 'today', label: 'Hoje' },
  { id: 'upcoming', label: 'Próximos' },
  { id: 'past', label: 'Passados' },
  { id: 'all', label: 'Todos' },
] as const
type TabId = (typeof TABS)[number]['id']

export default function MeusAgendamentosPage() {
  const router = useRouter()
  const [role, setRole] = useState<'sdr' | 'closer' | null>(null)
  const [closer, setCloser] = useState<Closer | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<TabId>('today')
  const [search, setSearch] = useState('')
  const [statusBooking, setStatusBooking] = useState<Booking | null>(null)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const meRes = await authFetch('/api/me')
      if (!meRes.ok) {
        router.replace('/login')
        return
      }
      const me = await meRes.json()

      if (me.role === 'admin') {
        router.replace('/agendamentos')
        return
      }

      if (me.role !== 'sdr' && me.role !== 'closer') {
        setError('Esta área é só pra SDR e Closer.')
        setLoading(false)
        return
      }

      setRole(me.role)
      const endpoint = me.role === 'sdr' ? '/api/sdr/bookings' : '/api/closer/bookings'
      const res = await authFetch(endpoint)
      const data = await res.json()
      if (!res.ok) {
        setError(data.message || data.error || 'Erro ao carregar')
        setLoading(false)
        return
      }
      if (me.role === 'closer') {
        setCloser(data.closer)
        setTab('today')
      } else {
        setTab('upcoming')
      }
      setBookings(data.bookings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const todayStr = new Date().toLocaleDateString('sv-SE')
  const filtered = bookings.filter((b) => {
    if (tab === 'today' && b.date !== todayStr) return false
    if (tab === 'upcoming' && (b.date < todayStr || b.status !== 'confirmed')) return false
    if (tab === 'past' && b.date >= todayStr && b.status === 'confirmed') return false
    if (search) {
      const q = search.toLowerCase()
      const hit =
        b.lead_name.toLowerCase().includes(q) ||
        (b.lead_email || '').toLowerCase().includes(q) ||
        (b.zoho_id || '').toLowerCase().includes(q) ||
        (b.sdr_name || '').toLowerCase().includes(q) ||
        (b.closer_name || '').toLowerCase().includes(q)
      if (!hit) return false
    }
    return true
  })

  const todayCount = bookings.filter((b) => b.date === todayStr && b.status === 'confirmed').length
  const pendingReview = bookings.filter((b) => b.date < todayStr && b.status === 'confirmed').length
  const upcomingCount = bookings.filter((b) => b.date >= todayStr && b.status === 'confirmed').length

  return (
    <main className="max-w-6xl mx-auto px-6 py-6 space-y-5 relative z-10">
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3">
          <p className="text-[13px] text-rose-300">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Hoje" value={todayCount} accent="text-blue-300" />
        <StatCard
          label={role === 'closer' ? 'Pendentes' : 'Passados confirmados'}
          value={pendingReview}
          accent={pendingReview > 0 ? 'text-amber-300' : 'text-zinc-400'}
          hint={pendingReview > 0 && role === 'closer' ? 'Marcar status' : undefined}
        />
        <StatCard label="Próximos" value={upcomingCount} accent="text-white" />
      </div>

      <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 space-y-3">
        <div className="flex items-center gap-2">
          <Search size={14} className="text-zinc-500" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por lead, email, Zoho, closer/SDR…"
            className="flex-1 bg-transparent text-[13px] text-white placeholder:text-zinc-600 focus:outline-none"
          />
          {role === 'sdr' && (
            <Link
              href="/agendamentos/novo"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-lg text-[12px] font-semibold hover:bg-zinc-200 transition-colors"
            >
              <Plus size={12} />
              Novo
            </Link>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-2.5 py-1 text-[12px] rounded-md transition-colors ${
                tab === t.id
                  ? 'bg-white text-black font-semibold'
                  : 'border border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:text-white'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-zinc-500 text-sm">
          <Loader2 size={15} className="animate-spin" />
          Carregando
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-12 text-center">
          <p className="text-zinc-500 text-sm">Nada por aqui ainda.</p>
          {role === 'sdr' && (
            <Link
              href="/agendamentos/novo"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors"
            >
              <Plus size={13} />
              Agendar reunião
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.04]">
          {filtered.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              todayStr={todayStr}
              role={role}
              onMarkStatus={role === 'closer' ? () => setStatusBooking(b) : undefined}
            />
          ))}
        </div>
      )}

      {statusBooking && role === 'closer' && closer && (
        <BookingStatusModal
          bookingId={statusBooking.id}
          leadName={statusBooking.lead_name}
          closerName={closer.name}
          closerSlug={closer.slug}
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
            load()
          }}
        />
      )}
    </main>
  )
}

function StatCard({
  label,
  value,
  accent,
  hint,
}: {
  label: string
  value: number
  accent: string
  hint?: string
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
      <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-1">
        {label}
      </p>
      <p className={`text-2xl font-semibold tabular ${accent}`}>{value}</p>
      {hint && <p className="text-[10px] text-zinc-600 mt-0.5">{hint}</p>}
    </div>
  )
}

function BookingRow({
  booking: b,
  todayStr,
  role,
  onMarkStatus,
}: {
  booking: Booking
  todayStr: string
  role: 'sdr' | 'closer' | null
  onMarkStatus?: () => void
}) {
  const isToday = b.date === todayStr
  const isPast = b.date < todayStr
  const isPendingReview = isPast && b.status === 'confirmed'
  const status = STATUS_STYLES[b.status as BookingStatus]
  const dateStr = isToday
    ? 'Hoje'
    : new Date(b.date + 'T12:00:00').toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })

  const counterpart = role === 'sdr' ? b.closer_name : b.sdr_name

  return (
    <div
      className={`px-5 py-4 hover:bg-white/[0.02] transition-colors ${
        isPendingReview && role === 'closer' ? 'bg-amber-500/[0.04]' : ''
      } ${isPast && !isPendingReview ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-white truncate">{b.lead_name}</p>
            {counterpart && (
              <>
                <span className="text-[10px] text-zinc-500">·</span>
                <span className="text-[12px] font-medium text-zinc-300">{counterpart}</span>
              </>
            )}
            {status && (
              <span
                className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border ${status.cls}`}
              >
                {status.label}
              </span>
            )}
            {isPendingReview && role === 'closer' && (
              <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/15 text-amber-300">
                Marcar
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 mt-1 text-[12px] text-zinc-400 flex-wrap">
            <span className="tabular flex items-center gap-1">
              <Calendar size={11} />
              {dateStr}
            </span>
            <span className="tabular flex items-center gap-1">
              <Clock size={11} />
              {b.time_start}
            </span>
            <span>{b.duration} min</span>
            {b.funnel && (
              <span className="bg-white/[0.04] border border-white/[0.06] px-1.5 py-0.5 rounded text-[10px]">
                {b.funnel}
              </span>
            )}
          </div>

          {role === 'closer' && (
            <div className="flex items-center gap-3 mt-2 text-[11px] text-zinc-500 flex-wrap">
              {b.lead_email && (
                <a
                  href={`mailto:${b.lead_email}`}
                  className="inline-flex items-center gap-1 hover:text-white transition-colors"
                >
                  <Mail size={10} />
                  {b.lead_email}
                </a>
              )}
              {b.lead_phone && (
                <a
                  href={`https://wa.me/${b.lead_phone.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-emerald-300 transition-colors"
                >
                  <Phone size={10} />
                  {b.lead_phone}
                </a>
              )}
              {b.zoho_id && (
                <a
                  href={ZOHO_LEAD_URL(b.zoho_id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-emerald-300 transition-colors"
                >
                  Zoho
                  <ExternalLink size={10} />
                </a>
              )}
            </div>
          )}

          {b.observations && role === 'closer' && (
            <p className="mt-2 text-[11px] text-zinc-400 italic">"{b.observations}"</p>
          )}
          {b.lost_reason && (
            <p className="mt-1 text-[11px] text-rose-300/80">Motivo: {b.lost_reason}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          {role === 'sdr' && b.zoho_id && (
            <a
              href={ZOHO_LEAD_URL(b.zoho_id)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-emerald-300 transition-colors"
            >
              Zoho
              <ExternalLink size={10} />
            </a>
          )}
          {b.meet_link && b.status === 'confirmed' && (
            <a
              href={b.meet_link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/15 border border-blue-500/30 text-blue-300 rounded-lg text-[12px] font-medium hover:bg-blue-500/25 transition-colors"
            >
              Meet
              <ExternalLink size={11} />
            </a>
          )}
          {onMarkStatus && (b.status === 'confirmed' || b.status === 'no_show') && (
            <button
              onClick={onMarkStatus}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-colors ${
                isPendingReview
                  ? 'bg-amber-500/20 border border-amber-500/40 text-amber-200 hover:bg-amber-500/30'
                  : 'bg-white/[0.04] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08]'
              }`}
            >
              <CircleDot size={11} />
              Marcar status
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
