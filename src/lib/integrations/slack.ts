const SLACK_API_BASE = 'https://slack.com/api'

async function slackFetch(method: string, body: Record<string, unknown>) {
  const token = process.env.SLACK_BOT_TOKEN
  if (!token) throw new Error('SLACK_BOT_TOKEN não configurado')

  const res = await fetch(`${SLACK_API_BASE}/${method}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (!data.ok) {
    throw new Error(`Slack error: ${data.error}`)
  }

  return data
}

// ─── Enviar DM para usuário ──────────────────────────────────────

export async function sendDm(userId: string, message: string) {
  if (!userId || !message) throw new Error('userId e message são obrigatórios')

  // Abrir conversa DM
  const conversation = await slackFetch('conversations.open', {
    users: userId,
  })

  const channelId = conversation.channel.id

  // Enviar mensagem
  const result = await slackFetch('chat.postMessage', {
    channel: channelId,
    text: message,
    mrkdwn: true,
  })

  return { success: true, ts: result.ts, channel: channelId }
}

// ─── Enviar mensagem no canal (com suporte a thread) ─────────────

export async function sendChannel(
  channel: string,
  message: string,
  options?: { thread_ts?: string; reply_broadcast?: boolean }
) {
  if (!channel || !message) throw new Error('channel e message são obrigatórios')

  const body: Record<string, unknown> = {
    channel,
    text: message,
    mrkdwn: true,
  }
  if (options?.thread_ts) body.thread_ts = options.thread_ts
  if (options?.reply_broadcast) body.reply_broadcast = true

  const result = await slackFetch('chat.postMessage', body)
  return { success: true, ts: result.ts, channel: result.channel }
}

// ─── Buscar usuário por email ────────────────────────────────────

export async function lookupUserByEmail(email: string) {
  if (!email) return null

  try {
    const data = await slackFetch('users.lookupByEmail', { email })
    return {
      id: data.user.id,
      name: data.user.real_name,
      display_name: data.user.profile.display_name,
    }
  } catch {
    return null
  }
}

// ─── Helper: substituir variáveis no template ────────────────────

export function renderTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key]
    if (val === undefined || val === null) return ''
    return String(val)
  })
}
