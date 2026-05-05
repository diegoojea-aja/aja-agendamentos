'use client'

import { useState } from 'react'
import { authFetch } from '@/lib/api-client'
import { Loader2, X, CheckCircle2, XCircle, UserX, RefreshCw } from 'lucide-react'

export type BookingStatus =
  | 'confirmed'
  | 'completed'
  | 'no_show'
  | 'cancelled'
  | 'rescheduled'
  | 'lost'

interface Props {
  bookingId: string
  leadName: string
  closerName: string
  closerSlug?: string
  date: string
  timeStart: string
  currentStatus: BookingStatus
  // Dados pra pré-preencher fluxo de reagendamento
  leadData?: {
    zoho_id?: string | null
    lead_email?: string | null
    lead_phone?: string | null
    sdr_name?: string | null
    funnel?: string | null
  }
  onClose: () => void
  onSaved: () => void
}

const LOST_REASONS = [
  'Sem interesse',
  'Fora do perfil',
  'Timing ruim',
  'Sem retorno',
  'Outro',
]

export function BookingStatusModal({
  bookingId,
  leadName,
  closerName,
  closerSlug,
  date,
  timeStart,
  currentStatus,
  leadData,
  onClose,
  onSaved,
}: Props) {
  const [stage, setStage] = useState<'main' | 'no_show'>('main')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [lostReason, setLostReason] = useState('')

  const dateLong = new Date(date + 'T12:00:00').toLocaleDateString('pt-BR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })

  async function handleReschedule() {
    if (!closerSlug) {
      setError('Closer slug não disponível pra reagendar.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      // Marca booking atual como rescheduled e abre o fluxo de novo
      // agendamento pré-preenchido. O novo booking gravará rescheduled_from_id
      // baseado no ?rebook=.
      const res = await authFetch(`/api/schedule/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rescheduled' }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao marcar como reagendado')
      }

      const params = new URLSearchParams()
      params.set('rebook', bookingId)
      params.set('nome', leadName)
      if (leadData?.zoho_id) params.set('zoho_id', leadData.zoho_id)
      if (leadData?.lead_email) params.set('email', leadData.lead_email)
      if (leadData?.lead_phone) params.set('telefone', leadData.lead_phone)
      if (leadData?.sdr_name) params.set('sdr', leadData.sdr_name)
      if (leadData?.funnel) params.set('funil', leadData.funnel)

      window.open(`/agendar/${closerSlug}?${params.toString()}`, '_blank')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setSubmitting(false)
    }
  }

  async function update(payload: { status: BookingStatus; lost_reason?: string }) {
    setSubmitting(true)
    setError('')
    try {
      const res = await authFetch(`/api/schedule/bookings/${bookingId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar')
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="card-enter max-w-md w-full rounded-2xl border border-white/[0.14] bg-zinc-950 p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 text-zinc-500 hover:text-white"
        >
          <X size={16} />
        </button>

        <div className="mb-5">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-1">
            Marcar status
          </p>
          <h3 className="text-base font-semibold text-white">{leadName}</h3>
          <p className="text-[12px] text-zinc-500 mt-0.5">
            {closerName} · {dateLong} · {timeStart}
          </p>
          {currentStatus !== 'confirmed' && (
            <p className="text-[11px] text-zinc-600 mt-1">
              Status atual: <span className="text-zinc-400">{statusLabel(currentStatus)}</span>
            </p>
          )}
        </div>

        {stage === 'main' && (
          <div className="space-y-2">
            <button
              disabled={submitting}
              onClick={() => update({ status: 'completed' })}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.08] hover:bg-emerald-500/[0.14] text-left transition-colors disabled:opacity-50"
            >
              <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
              <div>
                <p className="text-[14px] font-medium text-white">Compareceu</p>
                <p className="text-[11px] text-zinc-500">Reunião realizada com sucesso</p>
              </div>
            </button>

            <button
              disabled={submitting}
              onClick={() => setStage('no_show')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.08] hover:bg-amber-500/[0.14] text-left transition-colors disabled:opacity-50"
            >
              <UserX size={18} className="text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-[14px] font-medium text-white">No-show</p>
                <p className="text-[11px] text-zinc-500">Lead não compareceu</p>
              </div>
            </button>

            <button
              disabled={submitting}
              onClick={() => update({ status: 'cancelled' })}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-rose-500/20 bg-rose-500/[0.08] hover:bg-rose-500/[0.14] text-left transition-colors disabled:opacity-50"
            >
              <XCircle size={18} className="text-rose-400 flex-shrink-0" />
              <div>
                <p className="text-[14px] font-medium text-white">Cancelar</p>
                <p className="text-[11px] text-zinc-500">Cancelado antes da reunião</p>
              </div>
            </button>
          </div>
        )}

        {stage === 'no_show' && (
          <div className="space-y-3">
            <button
              onClick={() => setStage('main')}
              className="text-[12px] text-zinc-500 hover:text-white transition-colors"
            >
              ← voltar
            </button>

            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-3">
              <p className="text-[13px] text-zinc-300">
                Lead não compareceu. O que fazer?
              </p>

              {closerSlug && (
                <button
                  disabled={submitting}
                  onClick={handleReschedule}
                  className="w-full px-3 py-2.5 rounded-lg text-[13px] text-left border border-violet-500/20 bg-violet-500/[0.08] hover:bg-violet-500/[0.14] transition-colors disabled:opacity-50 flex items-center gap-2.5"
                >
                  <RefreshCw size={14} className="text-violet-400 flex-shrink-0" />
                  <div>
                    <p className="text-white font-medium">Reagendar</p>
                    <p className="text-[11px] text-zinc-500">Abre nova agenda em outra aba com lead pré-preenchido.</p>
                  </div>
                </button>
              )}

              <button
                disabled={submitting}
                onClick={() => update({ status: 'no_show' })}
                className="w-full px-3 py-2.5 rounded-lg text-[13px] text-left border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.06] transition-colors disabled:opacity-50"
              >
                <p className="text-white font-medium">Deixar pendente</p>
                <p className="text-[11px] text-zinc-500">Marca no-show. SDR decide depois.</p>
              </button>

              <div className="rounded-lg border border-rose-500/20 bg-rose-500/[0.06] p-3 space-y-2">
                <p className="text-[12px] text-rose-300 font-medium">Lead perdido</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {LOST_REASONS.map((reason) => (
                    <button
                      key={reason}
                      disabled={submitting}
                      onClick={() => setLostReason(reason)}
                      className={`px-2.5 py-1.5 rounded-md text-[11px] transition-all ${
                        lostReason === reason
                          ? 'bg-white text-black font-semibold'
                          : 'border border-white/[0.06] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <button
                  disabled={submitting || !lostReason}
                  onClick={() => update({ status: 'lost', lost_reason: lostReason })}
                  className="w-full mt-1 py-2 rounded-md text-[12px] font-semibold bg-rose-500 text-white hover:bg-rose-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Marcar como perdido
                </button>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="mt-3 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
            <p className="text-rose-400 text-[12px]">{error}</p>
          </div>
        )}

        {submitting && (
          <div className="mt-3 flex items-center justify-center gap-2 text-zinc-500 text-[12px]">
            <Loader2 size={13} className="animate-spin" />
            Atualizando
          </div>
        )}
      </div>
    </div>
  )
}

function statusLabel(s: BookingStatus): string {
  return (
    {
      confirmed: 'Confirmado',
      completed: 'Compareceu',
      no_show: 'No-show',
      cancelled: 'Cancelado',
      rescheduled: 'Reagendado',
      lost: 'Lead perdido',
    } as const
  )[s] || s
}

export const STATUS_STYLES: Record<BookingStatus, { label: string; cls: string }> = {
  confirmed: { label: 'Confirmado', cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  completed: { label: 'Compareceu', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  no_show: { label: 'No-show', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  cancelled: { label: 'Cancelado', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/20' },
  rescheduled: { label: 'Reagendado', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
  lost: { label: 'Perdido', cls: 'bg-zinc-700/30 text-zinc-400 border-zinc-700/50' },
}
