/**
 * Lógica de roteamento de leads pra closers.
 *
 * Objetivo: balancear (a) carga total e (b) distribuição por nível de
 * qualificação dos leads — cada closer tende a receber ~mesma quantidade
 * total e ~mesma proporção de cada bucket de score.
 *
 * Regras (em ordem de prioridade):
 *   1. Filtrar elegíveis: ativo, peso > 0, livre no horário,
 *      accepts_scores cobre o score do lead, accepts_products cobre o funil.
 *   2. Pra cada elegível, contar bookings dos últimos 30 dias com status
 *      que "consomem agenda" (confirmed/completed/no_show/lost).
 *   3. Escolher quem tem o menor count_no_bucket / peso.
 *   4. Empate → menor count_total / peso.
 *   5. Empate → last_assigned_at mais antigo (round-robin determinístico).
 */

export const SCORE_BUCKETS = [
  'Muito Qualificado',
  'Qualificado',
  'Neutro',
  'Semi Desqualificado',
] as const

export type ScoreBucket = (typeof SCORE_BUCKETS)[number] | 'Sem score'

export const COUNTABLE_STATUSES = ['confirmed', 'completed', 'no_show', 'lost'] as const

export const ROLLING_WINDOW_DAYS = 30

export function normalizeScore(rawScore: string | null | undefined): ScoreBucket {
  if (!rawScore || !rawScore.trim()) return 'Sem score'
  const trimmed = rawScore.trim()
  if ((SCORE_BUCKETS as readonly string[]).includes(trimmed)) {
    return trimmed as ScoreBucket
  }
  return 'Sem score'
}

/**
 * Closer aceita o score do lead?
 * accepts_scores vazio = aceita todos. Se preenchido, precisa incluir o bucket.
 */
export function acceptsScore(
  acceptsScores: string[] | null | undefined,
  bucket: ScoreBucket
): boolean {
  if (!acceptsScores || acceptsScores.length === 0) return true
  return acceptsScores.includes(bucket)
}

/**
 * Closer aceita o funil/produto do lead?
 * accepts_products vazio = aceita todos.
 */
export function acceptsProduct(
  acceptsProducts: string[] | null | undefined,
  funnel: string | null | undefined
): boolean {
  if (!acceptsProducts || acceptsProducts.length === 0) return true
  if (!funnel) return true
  return acceptsProducts.includes(funnel)
}

export function rollingWindowStart(now = new Date()): string {
  const d = new Date(now)
  d.setDate(d.getDate() - ROLLING_WINDOW_DAYS)
  return d.toISOString().slice(0, 10)
}

export interface CloserCounts {
  closer_id: string
  total: number
  byBucket: Record<ScoreBucket, number>
}

export interface ScoredCloser<TCloser extends { id: string; weight?: number; last_assigned_at?: string | null }> {
  closer: TCloser
  bucketCount: number
  totalCount: number
  weight: number
  bucketNorm: number
  totalNorm: number
}

/**
 * Pontua e ordena os closers candidatos pelo critério de roteamento.
 * Retorna array ordenado — primeiro = vencedor.
 */
export function scoreCandidates<
  TCloser extends {
    id: string
    weight?: number
    last_assigned_at?: string | null
  }
>(
  candidates: TCloser[],
  bucket: ScoreBucket,
  countsByCloserId: Map<string, CloserCounts>
): ScoredCloser<TCloser>[] {
  const scored: ScoredCloser<TCloser>[] = candidates.map((closer) => {
    const counts = countsByCloserId.get(closer.id)
    const bucketCount = counts?.byBucket[bucket] ?? 0
    const totalCount = counts?.total ?? 0
    const weight = closer.weight ?? 1
    const bucketNorm = weight > 0 ? bucketCount / weight : Infinity
    const totalNorm = weight > 0 ? totalCount / weight : Infinity
    return { closer, bucketCount, totalCount, weight, bucketNorm, totalNorm }
  })

  scored.sort((a, b) => {
    if (a.bucketNorm !== b.bucketNorm) return a.bucketNorm - b.bucketNorm
    if (a.totalNorm !== b.totalNorm) return a.totalNorm - b.totalNorm
    // Round-robin determinístico: quem foi escolhida há mais tempo leva.
    const aTs = a.closer.last_assigned_at ? new Date(a.closer.last_assigned_at).getTime() : 0
    const bTs = b.closer.last_assigned_at ? new Date(b.closer.last_assigned_at).getTime() : 0
    return aTs - bTs
  })

  return scored
}

export function buildChosenReason<
  TCloser extends { id: string; name: string; weight?: number; last_assigned_at?: string | null }
>(
  scored: ScoredCloser<TCloser>,
  bucket: ScoreBucket,
  totalCandidates: number
): string {
  const { closer, bucketCount, totalCount, weight, bucketNorm } = scored
  return (
    `${closer.name} — ${bucketCount} ${bucket}/30d, ${totalCount} total/30d, peso ${weight} ` +
    `(score ${bucketNorm.toFixed(2)}, ${totalCandidates} candidatas elegíveis)`
  )
}
