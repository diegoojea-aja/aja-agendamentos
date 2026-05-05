'use client'

import { useEffect, useState } from 'react'
import { authFetch } from '@/lib/api-client'
import {
  Users, Plus, Pencil, Loader2, X, AtSign, Hash, Power, Trash2, ExternalLink,
} from 'lucide-react'

interface WorkingHours {
  start: string
  end: string
  lunch_start: string
  lunch_end: string
  days: number[]
}

interface Closer {
  id: string
  name: string
  email: string
  slug: string
  photo_url: string | null
  active: boolean
  weight: number
  slack_user_id: string | null
  accepts_products: string[]
  duration_options: number[]
  working_hours: WorkingHours
  buffer_minutes: number
  created_at: string
}

const DAYS_LABEL = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const DEFAULT_HOURS: WorkingHours = {
  start: '09:00',
  end: '19:00',
  lunch_start: '12:00',
  lunch_end: '13:00',
  days: [1, 2, 3, 4, 5],
}

export default function ClosersAdminPage() {
  const [closers, setClosers] = useState<Closer[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Closer | null>(null)
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const res = await authFetch('/api/schedule/closers/admin')
      const data = await res.json()
      setClosers(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  async function handleToggleActive(c: Closer) {
    await authFetch(`/api/schedule/closers/admin/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !c.active }),
    })
    load()
  }

  async function handleDelete(c: Closer) {
    if (!confirm(`Deletar ${c.name}? Bookings existentes ficarão órfãos.`)) return
    await authFetch(`/api/schedule/closers/admin/${c.id}`, { method: 'DELETE' })
    load()
  }

  const showingForm = creating || editing !== null

  return (
    <main className="max-w-6xl mx-auto px-6 py-8 relative z-10 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-zinc-500 mb-1">
            Closers
          </p>
          <h2 className="text-2xl font-semibold tracking-tight text-white">
            {closers.length} {closers.length === 1 ? 'closer' : 'closers'} cadastrados
          </h2>
        </div>
        {!showingForm && (
          <button
            onClick={() => { setCreating(true); setEditing(null) }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-lg text-[13px] font-semibold hover:bg-zinc-200 transition-colors"
          >
            <Plus size={13} />
            Nova closer
          </button>
        )}
      </div>

      {/* Form */}
      {showingForm && (
        <CloserForm
          closer={editing}
          onClose={() => { setCreating(false); setEditing(null) }}
          onSaved={() => { setCreating(false); setEditing(null); load() }}
        />
      )}

      {/* List */}
      {loading ? (
        <p className="text-zinc-500 text-sm py-8 text-center">Carregando</p>
      ) : closers.length === 0 ? (
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-10 text-center">
          <Users size={24} className="text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400 text-sm">Nenhuma closer ainda — clica em &ldquo;Nova closer&rdquo; pra cadastrar.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {closers.map((c) => (
            <div
              key={c.id}
              className={`rounded-xl border p-4 flex items-start gap-4 transition-all ${
                c.active
                  ? 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]'
                  : 'border-white/[0.05] bg-white/[0.01] opacity-60'
              }`}
            >
              {/* Avatar */}
              {c.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.photo_url} alt={c.name} className="w-12 h-12 rounded-full object-cover ring-1 ring-white/10 flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/[0.06] ring-1 ring-white/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-sm font-semibold text-white">{c.name.charAt(0)}</span>
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-base font-semibold text-white truncate">{c.name}</p>
                  {!c.active && (
                    <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-zinc-700/40 text-zinc-400">
                      Desativada
                    </span>
                  )}
                  <span className="text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30">
                    Peso {c.weight}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-1 text-[12px] text-zinc-400 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <AtSign size={11} className="text-zinc-600" />
                    {c.email}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Hash size={11} className="text-zinc-600" />
                    {c.slug}
                  </span>
                  {c.slack_user_id && (
                    <span className="inline-flex items-center gap-1 text-zinc-500">
                      Slack: {c.slack_user_id}
                    </span>
                  )}
                </div>

                <div className="mt-2 flex items-center gap-3 text-[11px] text-zinc-500 flex-wrap">
                  <span>
                    {c.working_hours.start}–{c.working_hours.end}
                    {' · '}
                    almoço {c.working_hours.lunch_start}–{c.working_hours.lunch_end}
                  </span>
                  <span>
                    {c.working_hours.days.map((d) => DAYS_LABEL[d]).join(', ')}
                  </span>
                  <span>buffer {c.buffer_minutes}min</span>
                  {c.accepts_products.length > 0 && (
                    <span>aceita: {c.accepts_products.join(', ')}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={`/agendar/${c.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                  title="Abrir página de agendamento"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  onClick={() => { setEditing(c); setCreating(false) }}
                  className="p-2 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleToggleActive(c)}
                  className={`p-2 rounded-md transition-colors ${c.active ? 'text-zinc-500 hover:text-amber-400' : 'text-emerald-400 hover:text-emerald-300'} hover:bg-white/[0.06]`}
                  title={c.active ? 'Desativar' : 'Ativar'}
                >
                  <Power size={14} />
                </button>
                <button
                  onClick={() => handleDelete(c)}
                  className="p-2 rounded-md text-zinc-600 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                  title="Deletar"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

// ─── Form de criar/editar ────────────────────────────────────────────

function CloserForm({
  closer,
  onClose,
  onSaved,
}: {
  closer: Closer | null
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = closer !== null
  const [name, setName] = useState(closer?.name || '')
  const [email, setEmail] = useState(closer?.email || '')
  const [slug, setSlug] = useState(closer?.slug || '')
  const [photoUrl, setPhotoUrl] = useState(closer?.photo_url || '')
  const [weight, setWeight] = useState(closer?.weight ?? 1)
  const [slackUserId, setSlackUserId] = useState(closer?.slack_user_id || '')
  const [acceptsProducts, setAcceptsProducts] = useState((closer?.accepts_products || []).join(', '))
  const [hours, setHours] = useState<WorkingHours>(closer?.working_hours || DEFAULT_HOURS)
  const [bufferMinutes, setBufferMinutes] = useState(closer?.buffer_minutes ?? 15)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const payload = {
        name,
        email,
        slug,
        photo_url: photoUrl || undefined,
        weight,
        slack_user_id: slackUserId || undefined,
        accepts_products: acceptsProducts
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
        working_hours: hours,
        buffer_minutes: bufferMinutes,
      }

      const url = isEdit
        ? `/api/schedule/closers/admin/${closer!.id}`
        : '/api/schedule/closers/admin'
      const res = await authFetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Erro ao salvar')
      }
      onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  function toggleDay(d: number) {
    setHours((h) => ({
      ...h,
      days: h.days.includes(d) ? h.days.filter((x) => x !== d) : [...h.days, d].sort(),
    }))
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-white/[0.14] bg-white/[0.05] backdrop-blur-md p-6 space-y-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {isEdit ? `Editar ${closer!.name}` : 'Nova closer'}
        </h3>
        <button type="button" onClick={onClose} className="p-1 text-zinc-500 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Nome *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.12] focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </Field>
        <Field label="Email *">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.12] focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </Field>
        <Field label="Slug * (URL: /agendar/elisa)">
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            required
            placeholder="elisa"
            className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.12] focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </Field>
        <Field label="Foto (URL)">
          <input
            type="url"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://..."
            className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.12] focus:outline-none focus:ring-2 focus:ring-white/20"
          />
        </Field>
        <Field label="Peso na distribuição (1-10)">
          <input
            type="number"
            min={0}
            max={10}
            value={weight}
            onChange={(e) => setWeight(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
            className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.12] focus:outline-none focus:ring-2 focus:ring-white/20 tabular-nums"
          />
        </Field>
        <Field label="Slack User ID (DM)">
          <input
            value={slackUserId}
            onChange={(e) => setSlackUserId(e.target.value)}
            placeholder="U01ABCD..."
            className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.12] focus:outline-none focus:ring-2 focus:ring-white/20 font-mono"
          />
        </Field>
      </div>

      <Field label="Aceita produtos (separados por vírgula — vazio = todos)">
        <input
          value={acceptsProducts}
          onChange={(e) => setAcceptsProducts(e.target.value)}
          placeholder="ex: INSTratégica, Atmosfera"
          className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.12] focus:outline-none focus:ring-2 focus:ring-white/20"
        />
      </Field>

      {/* Working hours */}
      <div className="space-y-3">
        <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500">
          Horário de trabalho
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Início">
            <input type="time" value={hours.start} onChange={(e) => setHours({ ...hours, start: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.12]" />
          </Field>
          <Field label="Fim">
            <input type="time" value={hours.end} onChange={(e) => setHours({ ...hours, end: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.12]" />
          </Field>
          <Field label="Almoço início">
            <input type="time" value={hours.lunch_start} onChange={(e) => setHours({ ...hours, lunch_start: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.12]" />
          </Field>
          <Field label="Almoço fim">
            <input type="time" value={hours.lunch_end} onChange={(e) => setHours({ ...hours, lunch_end: e.target.value })} className="w-full px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.12]" />
          </Field>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-2">
            Dias
          </p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const checked = hours.days.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDay(d)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] transition-colors ${
                    checked
                      ? 'bg-white text-black font-semibold'
                      : 'border border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:bg-white/[0.06]'
                  }`}
                >
                  {DAYS_LABEL[d]}
                </button>
              )
            })}
          </div>
        </div>

        <Field label="Buffer entre reuniões (minutos)">
          <input
            type="number"
            min={0}
            max={60}
            value={bufferMinutes}
            onChange={(e) => setBufferMinutes(Math.max(0, Math.min(60, parseInt(e.target.value) || 0)))}
            className="w-32 px-3 py-2 rounded-lg text-sm text-white bg-white/[0.04] border border-white/[0.12] tabular-nums"
          />
        </Field>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t border-white/[0.08]">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 border border-white/[0.08] bg-white/[0.02] rounded-lg text-[13px] text-zinc-400 hover:bg-white/[0.06]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 px-5 py-2 bg-white text-black rounded-lg text-[13px] font-semibold hover:bg-zinc-200 disabled:opacity-50"
        >
          {submitting && <Loader2 size={13} className="animate-spin" />}
          {isEdit ? 'Salvar' : 'Criar'}
        </button>
      </div>
    </form>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  )
}
