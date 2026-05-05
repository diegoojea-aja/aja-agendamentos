'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { DarkShell } from '@/components/ui/DarkShell'
import { authFetch } from '@/lib/api-client'
import {
  ArrowLeft,
  UserPlus,
  Mail,
  Loader2,
  X,
  CheckCircle2,
  XCircle,
  Shield,
  Edit,
  Trash2,
} from 'lucide-react'

type Role = 'admin' | 'sdr' | 'comercial' | 'cs' | 'eventos' | 'closer'

interface User {
  id: string
  email: string
  name: string | null
  role: Role
  active: boolean
  created_at: string
}

const ROLES: { value: Role; label: string; color: string }[] = [
  { value: 'admin', label: 'Admin', color: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
  { value: 'sdr', label: 'SDR', color: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { value: 'closer', label: 'Closer', color: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' },
  { value: 'comercial', label: 'Comercial', color: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
  { value: 'cs', label: 'CS', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { value: 'eventos', label: 'Eventos', color: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
]

function roleBadge(role: Role) {
  const r = ROLES.find((x) => x.value === role)
  return r || ROLES[1]
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<User | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<Role>('sdr')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    try {
      const res = await authFetch('/api/users')
      const data = await res.json()
      setUsers(Array.isArray(data) ? data : [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  function resetForm() {
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('sdr')
    setError('')
  }

  function openCreate() {
    resetForm()
    setCreating(true)
    setEditing(null)
  }

  function openEdit(user: User) {
    setFormName(user.name || '')
    setFormEmail(user.email)
    setFormPassword('')
    setFormRole(user.role)
    setEditing(user)
    setCreating(false)
    setError('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    try {
      if (editing) {
        const res = await authFetch(`/api/users/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            role: formRole,
            ...(formPassword ? { password: formPassword } : {}),
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erro ao atualizar')
        }
      } else {
        const res = await authFetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            email: formEmail,
            password: formPassword,
            role: formRole,
          }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || 'Erro ao criar usuário')
        }
      }
      setEditing(null)
      setCreating(false)
      resetForm()
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleToggleActive(user: User) {
    await authFetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !user.active }),
    })
    load()
  }

  async function handleDelete(user: User) {
    if (!confirm(`Deletar ${user.name || user.email}?`)) return
    await authFetch(`/api/users/${user.id}`, { method: 'DELETE' })
    load()
  }

  const showingForm = creating || editing !== null

  return (
    <DarkShell>
      <header className="sticky top-0 z-30 backdrop-blur-xl bg-black/60 border-b border-white/[0.06] px-6 py-3.5">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/formularios"
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/[0.06] transition-colors"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight">Usuários</h1>
              <p className="text-[12px] text-zinc-500">{users.length} {users.length === 1 ? 'usuário' : 'usuários'}</p>
            </div>
          </div>
          {!showingForm && (
            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-lg text-[13px] font-semibold hover:bg-zinc-200 transition-colors"
            >
              <UserPlus size={13} />
              Novo usuário
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 relative z-10 space-y-5">
        {/* Formulário criar/editar */}
        {showingForm && (
          <div className="card-enter rounded-2xl border border-white/[0.14] bg-white/[0.05] backdrop-blur-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-white">
                {editing ? 'Editar usuário' : 'Novo usuário'}
              </h2>
              <button
                onClick={() => { setCreating(false); setEditing(null); resetForm() }}
                className="p-1 text-zinc-500 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-1.5">
                    Nome
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    placeholder="Nome completo"
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.12] hover:border-white/[0.22] focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-1.5">
                    E-mail {editing && <span className="text-zinc-600">(não editável)</span>}
                  </label>
                  <input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    required
                    disabled={!!editing}
                    placeholder="email@ajaeducacao.com.br"
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.12] hover:border-white/[0.22] focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-1.5">
                    Senha {editing && <span className="text-zinc-600">(opcional)</span>}
                  </label>
                  <input
                    type="text"
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    required={!editing}
                    minLength={editing ? undefined : 8}
                    placeholder={editing ? 'Deixe em branco pra manter' : 'Mínimo 8 caracteres'}
                    className="w-full px-4 py-2.5 rounded-xl text-sm text-white bg-white/[0.04] border border-white/[0.12] hover:border-white/[0.22] focus:outline-none focus:ring-2 focus:ring-white/20 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-1.5">
                    Papel
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {ROLES.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setFormRole(r.value)}
                        className={`px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all border ${
                          formRole === r.value
                            ? r.color
                            : 'border-white/[0.08] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.06]'
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5">
                  <p className="text-rose-400 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-white text-black rounded-xl text-sm font-semibold hover:bg-zinc-200 disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  {submitting && <Loader2 size={14} className="animate-spin" />}
                  {editing ? 'Salvar alterações' : 'Criar usuário'}
                </button>
                <button
                  type="button"
                  onClick={() => { setCreating(false); setEditing(null); resetForm() }}
                  className="px-5 py-2.5 border border-white/[0.08] bg-white/[0.02] rounded-xl text-sm text-zinc-300 hover:bg-white/[0.06] transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Lista de usuários */}
        {loading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-zinc-500 text-sm">
            <Loader2 size={15} className="animate-spin" />
            Carregando
          </div>
        ) : users.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-12 text-center">
            <p className="text-zinc-500 text-sm mb-4">Nenhum usuário ainda.</p>
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-white text-black rounded-xl text-sm font-semibold hover:bg-zinc-200 transition-colors"
            >
              <UserPlus size={13} />
              Criar primeiro usuário
            </button>
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] overflow-hidden divide-y divide-white/[0.04]">
            {users.map((u) => {
              const roleStyle = roleBadge(u.role)
              return (
                <div
                  key={u.id}
                  className={`px-5 py-4 flex items-center gap-4 hover:bg-white/[0.02] transition-colors ${!u.active ? 'opacity-50' : ''}`}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/[0.08] flex items-center justify-center text-white font-semibold text-sm">
                    {(u.name || u.email).charAt(0).toUpperCase()}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-white truncate">
                        {u.name || '(sem nome)'}
                      </p>
                      <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded border ${roleStyle.color}`}>
                        {roleStyle.label}
                      </span>
                      {!u.active && (
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-zinc-500 bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded">
                          Inativo
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-[12px] text-zinc-500">
                      <Mail size={11} />
                      <span className="truncate">{u.email}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleToggleActive(u)}
                      title={u.active ? 'Desativar' : 'Ativar'}
                      className="p-2 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      {u.active ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    </button>
                    <button
                      onClick={() => openEdit(u)}
                      title="Editar"
                      className="p-2 rounded-md text-zinc-500 hover:text-white hover:bg-white/[0.06] transition-colors"
                    >
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => handleDelete(u)}
                      title="Deletar"
                      className="p-2 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Legenda de papéis */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
          <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-zinc-500 mb-3 flex items-center gap-1.5">
            <Shield size={12} />
            Papéis e permissões
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px] text-zinc-400">
            <div><span className="text-rose-300 font-semibold">Admin</span> — acesso total, pode criar usuários e ver tudo</div>
            <div><span className="text-blue-300 font-semibold">SDR</span> — agenda reuniões, vê seus agendamentos em /sdr</div>
            <div><span className="text-cyan-300 font-semibold">Closer</span> — recebe reuniões, marca status em /closer</div>
            <div><span className="text-violet-300 font-semibold">Comercial</span> — vê agendamentos, métricas comerciais</div>
            <div><span className="text-emerald-300 font-semibold">CS</span> — customer success, acompanha mentoradas</div>
            <div><span className="text-amber-300 font-semibold">Eventos</span> — gestão de eventos (futuro)</div>
          </div>
        </div>
      </main>
    </DarkShell>
  )
}
