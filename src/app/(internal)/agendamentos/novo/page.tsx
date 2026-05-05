'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import {
  Calendar, Loader2, CheckCircle2, ArrowRight, Users,
  Copy, Check, MessageCircle, Video, ExternalLink,
} from 'lucide-react'

interface Closer {
  id: string
  name: string
  slug: string
  duration_options: number[]
  photo_url?: string | null
}

const ZOHO_LEAD_URL = (id: string) =>
  `https://one.zoho.com/zohoone/ajacomosejafosse/home/cxapp/crm/org836031329/tab/Potentials/${id}`

const DEFAULT_FUNNELS = ['Sessão', 'Aplicação Direta', 'Indicação', 'Eventos']

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

function getNext7Days() {
  const days = []
  const now = new Date()
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    days.push({
      date: d.toLocaleDateString('sv-SE'),
      dayName: DAY_NAMES[d.getDay()],
      dayNum: d.getDate(),
      monthName: MONTH_NAMES[d.getMonth()],
      isToday: i === 0,
    })
  }
  return days
}

export default function AgendarAutoPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <AgendarAutoPageInner />
    </Suspense>
  )
}

function AgendarAutoPageInner() {
  const searchParams = useSearchParams()

  // Prefill from URL (CRM Zoho)
  const prefillName = searchParams.get('nome') || ''
  const prefillPhone = searchParams.get('telefone') || ''
  const prefillEmail = searchParams.get('email') || ''
  const prefillZohoId = searchParams.get('zoho_id') || ''
  const prefillSdr = searchParams.get('sdr') || ''
  const prefillSdrNote = searchParams.get('nota_sdr') || ''
  const prefillScore = searchParams.get('score') || ''
  const prefillDataCadastro = searchParams.get('data_cadastro') || ''
  const prefillFunil = searchParams.get('funil') || ''
  const prefillObs = searchParams.get('obs') || ''

  const [closers, setClosers] = useState<Closer[]>([])
  const [duration, setDuration] = useState<number>(30)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [slots, setSlots] = useState<string[]>([])
  const [slotsLoading, setSlotsLoading] = useState(false)
  const [slotsWarning, setSlotsWarning] = useState('')
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)

  const [leadName, setLeadName] = useState(prefillName)
  const [leadPhone, setLeadPhone] = useState(prefillPhone)
  const [leadEmail, setLeadEmail] = useState(prefillEmail)
  const [zohoId, setZohoId] = useState(prefillZohoId)
  const [sdrName, setSdrName] = useState(prefillSdr)
  const [sdrNote, setSdrNote] = useState(prefillSdrNote)
  const [funnel, setFunnel] = useState(prefillFunil || 'Sessão')
  const [observations, setObservations] = useState(prefillObs)

  const funnelOptions = prefillFunil && !DEFAULT_FUNNELS.includes(prefillFunil)
    ? [...DEFAULT_FUNNELS, prefillFunil]
    : DEFAULT_FUNNELS

  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState<{
    closer: string
    closer_photo: string | null
    date: string
    time_start: string
    time_end: string
    lead_name: string
    lead_phone: string | null
    meet_link: string | null
    zoho_id: string | null
    google_synced: boolean
    distribution?: { available_closers: number; chosen_reason: string }
  } | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState<'meet' | 'whatsapp' | null>(null)

  const days = getNext7Days()

  useEffect(() => {
    fetch('/api/schedule/closers')
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : []
        setClosers(list)
        if (list.length > 0) {
          setDuration(list[0].duration_options?.[0] || 30)
        }
      })
  }, [])

  useEffect(() => {
    if (!selectedDate || !duration) return
    setSlotsLoading(true)
    setSlots([])
    setSelectedSlot(null)
    setSlotsWarning('')

    fetch(`/api/schedule/auto/slots?date=${selectedDate}&duration=${duration}`)
      .then((r) => r.json())
      .then((data) => {
        setSlots(data.slots || [])
        if (data._warning) setSlotsWarning(data._warning)
        setSlotsLoading(false)
      })
      .catch(() => setSlotsLoading(false))
  }, [selectedDate, duration])

  async function handleBook() {
    if (!selectedDate || !selectedSlot || !duration) {
      setError('Selecione data e horário.')
      return
    }
    if (!leadName.trim() || !leadEmail.trim() || !leadPhone.trim() || !zohoId.trim()) {
      setError('Preencha nome, e-mail, telefone e ID do Zoho.')
      return
    }

    setBooking(true)
    setError('')

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData.session?.access_token
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (token) headers.Authorization = `Bearer ${token}`

      const res = await fetch('/api/schedule/auto/book', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          lead_name: leadName.trim(),
          lead_email: leadEmail.trim(),
          lead_phone: leadPhone.trim(),
          zoho_id: zohoId.trim(),
          sdr_name: sdrName.trim() || undefined,
          sdr_note: sdrNote.trim() || undefined,
          lead_score: prefillScore.trim() || undefined,
          lead_registered_at: prefillDataCadastro.trim() || undefined,
          funnel: funnel.trim() || undefined,
          observations: observations.trim(),
          date: selectedDate,
          time_start: selectedSlot,
          duration,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        setError(result.error || 'Não foi possível agendar — tente de novo.')
        setBooking(false)
        return
      }

      setBooked({ ...result.booking, distribution: result.distribution })
    } catch {
      setError('Falha de conexão. Tente novamente.')
    } finally {
      setBooking(false)
    }
  }

  // ─── Confirmation ───
  if (booked) {
    const dateLong = new Date(booked.date + 'T12:00:00').toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    const initials = booked.closer
      .split(/\s+/)
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
    const firstName = booked.lead_name.trim().split(/\s+/)[0]

    const whatsappMsg = [
      `Oi ${firstName}!`,
      '',
      `Sua reunião com ${booked.closer} (AJA Educação) está confirmada:`,
      '',
      `${dateLong.charAt(0).toUpperCase() + dateLong.slice(1)}`,
      `Horário: ${booked.time_start} — ${booked.time_end}`,
      booked.meet_link ? `Link do Meet: ${booked.meet_link}` : null,
      '',
      'Você também recebeu o convite por e-mail, com lembrete automático 2h antes da reunião.',
      '',
      'Qualquer coisa me chama aqui!',
    ]
      .filter((l) => l !== null)
      .join('\n')

    async function copy(text: string, which: 'meet' | 'whatsapp') {
      try {
        await navigator.clipboard.writeText(text)
        setCopied(which)
        setTimeout(() => setCopied(null), 2000)
      } catch { /* noop */ }
    }

    function resetForNewBooking() {
      setBooked(null)
      setSelectedSlot(null)
      setSelectedDate(null)
      setLeadName('')
      setLeadPhone('')
      setLeadEmail('')
      setZohoId('')
      setSdrName('')
      setSdrNote('')
      setObservations('')
      setFunnel('Sessão')
    }

    return (
      <>
        <main className="flex-1 flex items-center justify-center px-6 py-10 sm:py-16 relative z-10">
          <div className="card-enter max-w-lg w-full space-y-4">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={24} className="text-emerald-400" />
              </div>
              <h2 className="text-lg font-semibold tracking-tight text-white mb-1">
                Reunião agendada
              </h2>
              <p className="text-zinc-500 text-[13px]">
                {booked.google_synced
                  ? 'Convite enviado pro lead por e-mail'
                  : 'Salvo no sistema (Google Calendar pendente)'}
              </p>
              {booked.distribution && (
                <p className="text-[11px] text-zinc-600 mt-2">
                  {booked.distribution.chosen_reason}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.04] to-white/[0.01] p-5 flex items-center gap-4">
              {booked.closer_photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={booked.closer_photo}
                  alt={booked.closer}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-white/10"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-white/[0.06] ring-2 ring-white/10 flex items-center justify-center">
                  <span className="text-base font-semibold text-white tracking-wide">{initials}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-0.5">
                  Closer atribuída
                </p>
                <p className="text-lg font-semibold text-white tracking-tight truncate">
                  {booked.closer}
                </p>
                <p className="text-[13px] text-zinc-400 capitalize">
                  {dateLong} · {booked.time_start} — {booked.time_end}
                </p>
              </div>
            </div>

            {booked.meet_link && (
              <button
                onClick={() => copy(booked.meet_link!, 'meet')}
                className="w-full rounded-2xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] transition-colors p-4 flex items-center gap-3 text-left"
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.04] flex items-center justify-center flex-shrink-0">
                  <Video size={18} className="text-zinc-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500">
                    Google Meet
                  </p>
                  <p className="text-[13px] text-white font-medium truncate">
                    {booked.meet_link.replace(/^https?:\/\//, '')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 text-[12px] text-zinc-400 flex-shrink-0">
                  {copied === 'meet' ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-400">Copiado</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copiar</span>
                    </>
                  )}
                </div>
              </button>
            )}

            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 space-y-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500">
                  Lead
                </p>
                <p className="text-[13px] text-white font-medium truncate">{booked.lead_name}</p>
              </div>
              {booked.lead_phone && (
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500">
                    Telefone
                  </p>
                  <p className="text-[13px] text-zinc-300 tabular">{booked.lead_phone}</p>
                </div>
              )}
              {booked.zoho_id && (
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500">
                    Zoho
                  </p>
                  <a
                    href={ZOHO_LEAD_URL(booked.zoho_id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] text-white hover:text-emerald-300 transition-colors"
                  >
                    <span className="tabular">{booked.zoho_id}</span>
                    <ExternalLink size={12} className="text-zinc-500" />
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => copy(whatsappMsg, 'whatsapp')}
                className="w-full py-3 rounded-xl text-[13px] font-medium transition-colors flex items-center justify-center gap-2 bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/20"
              >
                {copied === 'whatsapp' ? (
                  <>
                    <Check size={15} />
                    Mensagem copiada
                  </>
                ) : (
                  <>
                    <MessageCircle size={15} />
                    Copiar mensagem pro WhatsApp
                  </>
                )}
              </button>

              <button
                onClick={resetForNewBooking}
                className="w-full py-2.5 text-center border border-white/[0.08] bg-white/[0.02] rounded-xl text-[13px] text-zinc-300 hover:bg-white/[0.06] transition-colors"
              >
                Novo agendamento
              </button>
            </div>
          </div>
        </main>
      </>
    )
  }

  // ─── Booking flow ───
  return (
    <>
      <main className="flex-1 max-w-2xl w-full mx-auto px-6 py-10 sm:py-16 relative z-10">
        <div className="text-center mb-10 hero-enter">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-4 bg-white/[0.03] border border-white/[0.08] px-3 py-1.5 rounded-full">
            <Calendar size={12} />
            Agendamento
          </div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white mb-2">
            Agendar sessão estratégica
          </h1>
          <p className="text-zinc-400 text-sm max-w-md mx-auto">
            Escolha o horário. O sistema distribui automaticamente para a closer disponível.
          </p>
        </div>

        <div className="card-enter space-y-5">
          {/* 1. Data */}
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
            <h2 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-3">
              Data
            </h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {days.map((day) => (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  className={`flex-shrink-0 w-[72px] py-3 rounded-xl text-center transition-all ${
                    selectedDate === day.date
                      ? 'bg-white text-black'
                      : 'border border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500">
                    {day.isToday ? 'Hoje' : day.dayName}
                  </p>
                  <p className="text-lg font-semibold tabular leading-tight mt-0.5">
                    {day.dayNum}
                  </p>
                  <p className={`text-[10px] ${selectedDate === day.date ? 'text-zinc-500' : 'text-zinc-600'}`}>
                    {day.monthName}
                  </p>
                </button>
              ))}
            </div>
          </section>

          {/* 2. Horários */}
          {selectedDate && (
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <h2 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-3">
                Horário disponível
              </h2>
              {slotsLoading ? (
                <div className="flex items-center justify-center py-8 gap-2 text-zinc-500 text-sm">
                  <Loader2 size={16} className="animate-spin" />
                  Consultando agendas
                </div>
              ) : slots.length === 0 ? (
                <p className="text-zinc-500 text-sm text-center py-6">
                  Sem horários disponíveis nesta data.
                </p>
              ) : (
                <>
                  {slotsWarning && (
                    <p className="text-amber-400/80 text-[11px] mb-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
                      Google Calendar não configurado — slots teóricos.
                    </p>
                  )}
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {slots.map((slot) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`py-2.5 rounded-xl text-sm font-medium tabular transition-all ${
                          selectedSlot === slot
                            ? 'bg-white text-black'
                            : 'border border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {/* 3. Dados do lead */}
          {selectedSlot && (
            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
              <h2 className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-4">
                Dados do lead
              </h2>

              <div className="space-y-3">
                {/* ID Zoho */}
                <div>
                  <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-1.5 block">
                    ID Zoho *
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={zohoId}
                      onChange={(e) => setZohoId(e.target.value)}
                      placeholder="Ex: 5521234000001234567"
                      className="flex-1 px-4 py-3 rounded-xl text-sm text-white bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-white/20 tabular transition-colors"
                    />
                    {zohoId.trim() && (
                      <a
                        href={ZOHO_LEAD_URL(zohoId.trim())}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 rounded-xl text-[12px] text-zinc-300 border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] transition-colors"
                        title="Abrir no Zoho CRM"
                      >
                        <ExternalLink size={13} />
                        Zoho
                      </a>
                    )}
                  </div>
                </div>

                <input
                  type="text"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="Nome do lead *"
                  className="w-full px-4 py-3 rounded-xl text-sm text-white bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-white/30 transition-colors"
                />

                <div className="flex gap-3">
                  <input
                    type="email"
                    value={leadEmail}
                    onChange={(e) => setLeadEmail(e.target.value)}
                    placeholder="E-mail *"
                    className="flex-1 px-4 py-3 rounded-xl text-sm text-white bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
                  />
                  <input
                    type="tel"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder="Telefone *"
                    className="flex-1 px-4 py-3 rounded-xl text-sm text-white bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-1.5 block">
                    Funil
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {funnelOptions.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => setFunnel(f)}
                        className={`px-3 py-2 rounded-xl text-[13px] transition-all ${
                          funnel === f
                            ? 'bg-white text-black font-semibold'
                            : 'border border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-1.5 block">
                    SDR
                  </label>
                  <input
                    type="text"
                    value={sdrName}
                    onChange={(e) => setSdrName(e.target.value)}
                    placeholder="Quem está agendando"
                    className="w-full px-4 py-3 rounded-xl text-sm text-white bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-1.5 block">
                    Nota da SDR
                  </label>
                  <textarea
                    value={sdrNote}
                    onChange={(e) => setSdrNote(e.target.value)}
                    placeholder="Contexto da ligação, dor, urgência"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-white/20 resize-y transition-colors"
                  />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-1.5 block">
                    Observações
                  </label>
                  <textarea
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    placeholder="Outras informações"
                    rows={2}
                    className="w-full px-4 py-3 rounded-xl text-sm text-white bg-white/[0.02] border border-white/[0.08] hover:border-white/[0.14] focus:outline-none focus:ring-2 focus:ring-white/20 resize-y transition-colors"
                  />
                </div>

                {(prefillScore || prefillDataCadastro) && (
                  <div className="flex gap-3 text-[12px] text-zinc-500 pt-1">
                    {prefillScore && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-zinc-600">Score:</span>
                        <span className="text-zinc-300 font-medium">{prefillScore}</span>
                      </span>
                    )}
                    {prefillDataCadastro && (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="text-zinc-600">Cadastrado em:</span>
                        <span className="text-zinc-300 font-medium tabular">
                          {new Date(prefillDataCadastro + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-3 bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
                  <p className="text-rose-400 text-sm">{error}</p>
                </div>
              )}

              <button
                onClick={handleBook}
                disabled={
                  booking ||
                  !leadName.trim() ||
                  !leadEmail.trim() ||
                  !leadPhone.trim() ||
                  !zohoId.trim()
                }
                className="w-full mt-5 py-3 bg-white text-black rounded-xl text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                {booking ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    Agendando
                  </>
                ) : (
                  'Agendar reunião'
                )}
              </button>
            </section>
          )}

          {/* Link pra agendas individuais */}
          {closers.length > 0 && (
            <div className="pt-4 border-t border-white/[0.06]">
              <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-600 mb-3 flex items-center gap-1.5">
                <Users size={11} />
                Agenda individual
              </p>
              <div className="flex flex-wrap gap-2">
                {closers.map((c) => (
                  <Link
                    key={c.id}
                    href={`/agendar/${c.slug}`}
                    className="text-[12px] text-zinc-500 hover:text-white border border-white/[0.06] hover:border-white/[0.14] px-3 py-1.5 rounded-lg transition-colors"
                  >
                    {c.name} <ArrowRight size={10} className="inline ml-1" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>

    </>
  )
}
