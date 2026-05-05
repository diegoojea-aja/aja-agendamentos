'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Calendar as CalendarIcon,
  Users,
  Video,
  MapPin,
  Loader2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

interface AgendaEvent {
  id: string
  summary: string
  start: string
  end: string
  duration_min: number
  attendees_count: number
  location: string | null
  meet_link: string | null
  status: string
}

interface Agenda {
  closer: { name: string; slug: string; email: string }
  events: AgendaEvent[]
  error: string | null
}

const CLOSER_COLORS = [
  { bar: 'bg-blue-500', text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  { bar: 'bg-violet-500', text: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  { bar: 'bg-amber-500', text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  { bar: 'bg-rose-500', text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
]

function formatTime(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    })
  } catch {
    return iso
  }
}

export default function AgendasPage() {
  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE'))
  const [agendas, setAgendas] = useState<Agenda[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/schedule/admin/agenda?date=${date}`)
      .then((r) => r.json())
      .then((data) => {
        setAgendas(data.agendas || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [date])

  function shiftDate(days: number) {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + days)
    setDate(d.toLocaleDateString('sv-SE'))
  }

  const today = new Date().toLocaleDateString('sv-SE')
  const dateObj = new Date(date + 'T12:00:00')

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 pt-6 flex items-center justify-end gap-1">
        <button
          onClick={() => shiftDate(-1)}
          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <ChevronLeft size={16} />
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-1 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-white/20"
        />
        <button
          onClick={() => shiftDate(1)}
          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
        >
          <ChevronRight size={16} />
        </button>
        {date !== today && (
          <button
            onClick={() => setDate(today)}
            className="ml-2 px-2.5 py-1 text-[12px] text-zinc-400 hover:text-white border border-white/[0.08] rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            Hoje
          </button>
        )}
      </div>

      <main className="max-w-6xl mx-auto px-6 py-6 relative z-10">
        <div className="mb-6">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-1">
            {date === today ? 'Hoje' : ''}
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-white capitalize">
            {dateObj.toLocaleDateString('pt-BR', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </h2>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-zinc-500">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-sm">Consultando agendas</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {agendas.map((a, i) => {
              const color = CLOSER_COLORS[i % CLOSER_COLORS.length]
              return (
                <div
                  key={a.closer.slug}
                  className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden"
                >
                  {/* Header com closer */}
                  <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${color.bar} flex items-center justify-center text-white text-[13px] font-semibold`}>
                        {a.closer.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">{a.closer.name}</p>
                        <p className="text-[11px] text-zinc-500 font-mono">{a.closer.email}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${color.bg} ${color.text} ${color.border}`}>
                      {a.events.length} {a.events.length === 1 ? 'evento' : 'eventos'}
                    </span>
                  </div>

                  {/* Lista de eventos */}
                  <div className="divide-y divide-white/[0.04]">
                    {a.error ? (
                      <p className="text-rose-400 text-[13px] text-center py-6 px-5">
                        Erro: {a.error}
                      </p>
                    ) : a.events.length === 0 ? (
                      <p className="text-zinc-500 text-[13px] text-center py-8">
                        Dia livre
                      </p>
                    ) : (
                      a.events.map((e) => (
                        <div key={e.id} className="px-5 py-3 hover:bg-white/[0.02]">
                          <div className="flex items-start gap-3">
                            {/* Horário */}
                            <div className="flex-shrink-0 w-20 text-right">
                              <p className="text-sm font-semibold text-white tabular">
                                {formatTime(e.start)}
                              </p>
                              <p className="text-[10px] text-zinc-500 tabular">
                                {e.duration_min}min
                              </p>
                            </div>

                            {/* Divisor colorido */}
                            <div className={`w-1 rounded-full ${color.bar} self-stretch flex-shrink-0`} />

                            {/* Detalhes */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-white truncate">
                                {e.summary}
                              </p>
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-zinc-500">
                                <span className="tabular">
                                  {formatTime(e.start)} — {formatTime(e.end)}
                                </span>
                                {e.attendees_count > 0 && (
                                  <span className="flex items-center gap-0.5">
                                    <Users size={10} />
                                    {e.attendees_count}
                                  </span>
                                )}
                                {e.meet_link && (
                                  <a
                                    href={e.meet_link}
                                    target="_blank"
                                    className="flex items-center gap-0.5 text-emerald-400 hover:text-emerald-300"
                                  >
                                    <Video size={10} />
                                    Meet
                                  </a>
                                )}
                                {e.location && (
                                  <span className="flex items-center gap-0.5 truncate">
                                    <MapPin size={10} />
                                    {e.location}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer com link pra Google Calendar */}
                  <div className="px-5 py-3 border-t border-white/[0.06]">
                    <a
                      href={`https://calendar.google.com/calendar/u/0/r/day/${dateObj.getFullYear()}/${String(dateObj.getMonth() + 1).padStart(2, '0')}/${String(dateObj.getDate()).padStart(2, '0')}`}
                      target="_blank"
                      className="text-[11px] text-zinc-500 hover:text-white flex items-center gap-1 transition-colors"
                    >
                      Abrir Google Calendar
                      <ExternalLink size={10} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </>
  )
}
