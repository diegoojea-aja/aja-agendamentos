/**
 * Logger estruturado simples — emite JSON de uma linha pra Vercel coletar.
 *
 * Exemplo de uso em rota:
 *   logError('book/create', err, { closer_slug: slug, lead_email })
 *
 * Saída no Vercel logs:
 *   {"level":"error","scope":"book/create","msg":"...","ctx":{...},"ts":"..."}
 *
 * Vantagens vs console.error nu:
 *   - Padrão consistente facilita grep nos logs
 *   - Captura stack do Error
 *   - Contexto estruturado (não vira string concatenada)
 *
 * Quando trocar por Sentry: substituir as chamadas — assinatura igual.
 */

export interface LogContext {
  [key: string]: unknown
}

function emit(level: 'info' | 'warn' | 'error', scope: string, msg: string, ctx?: LogContext, err?: unknown) {
  const payload: Record<string, unknown> = {
    level,
    scope,
    msg,
    ts: new Date().toISOString(),
  }
  if (ctx && Object.keys(ctx).length > 0) payload.ctx = ctx
  if (err) {
    if (err instanceof Error) {
      payload.err = {
        name: err.name,
        message: err.message,
        stack: err.stack?.split('\n').slice(0, 8).join('\n'),
      }
    } else {
      payload.err = String(err)
    }
  }

  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

export function logInfo(scope: string, msg: string, ctx?: LogContext) {
  emit('info', scope, msg, ctx)
}

export function logWarn(scope: string, msg: string, ctx?: LogContext) {
  emit('warn', scope, msg, ctx)
}

export function logError(scope: string, err: unknown, ctx?: LogContext) {
  const msg = err instanceof Error ? err.message : 'Erro desconhecido'
  emit('error', scope, msg, ctx, err)
}
