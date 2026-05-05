import { google, calendar_v3 } from 'googleapis'

/**
 * Google Calendar via Service Account com Domain-Wide Delegation.
 *
 * Setup necessário:
 * 1. Google Cloud Console → habilitar Calendar API
 * 2. Criar Service Account → baixar JSON key
 * 3. Workspace Admin → Domain-Wide Delegation → adicionar SA com scopes:
 *    - https://www.googleapis.com/auth/calendar.freebusy
 *    - https://www.googleapis.com/auth/calendar.events
 * 4. Base64 encode do JSON → env var GOOGLE_SERVICE_ACCOUNT_KEY
 */

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.freebusy',
  'https://www.googleapis.com/auth/calendar.events',
]

function getServiceAccountKey() {
  const b64 = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!b64) throw new Error('GOOGLE_SERVICE_ACCOUNT_KEY não configurado')
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf-8'))
}

/**
 * Cria client do Google Calendar impersonando o email da closer.
 */
function getCalendarClient(closerEmail: string): calendar_v3.Calendar {
  const key = getServiceAccountKey()
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    subject: closerEmail, // impersonate
  })
  return google.calendar({ version: 'v3', auth })
}

/**
 * Retorna períodos ocupados de uma closer num dia específico.
 * Timezone: America/Sao_Paulo (BRT).
 */
export async function getFreeBusy(
  closerEmail: string,
  date: string // YYYY-MM-DD
): Promise<{ start: string; end: string }[]> {
  const calendar = getCalendarClient(closerEmail)
  const tz = 'America/Sao_Paulo'

  const dayStart = `${date}T00:00:00-03:00`
  const dayEnd = `${date}T23:59:59-03:00`

  const res = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart,
      timeMax: dayEnd,
      timeZone: tz,
      items: [{ id: closerEmail }],
    },
  })

  const busy = res.data.calendars?.[closerEmail]?.busy || []
  return busy.map((b) => ({
    start: b.start || '',
    end: b.end || '',
  }))
}

/**
 * Lista eventos detalhados da agenda de uma closer num dia.
 * Retorna summary, hora, participantes e link (se tiver Meet).
 */
export async function listEvents(
  closerEmail: string,
  date: string
): Promise<{
  id: string
  summary: string
  start: string
  end: string
  duration_min: number
  attendees_count: number
  location: string | null
  meet_link: string | null
  status: string
}[]> {
  const calendar = getCalendarClient(closerEmail)
  const tz = 'America/Sao_Paulo'

  const timeMin = `${date}T00:00:00-03:00`
  const timeMax = `${date}T23:59:59-03:00`

  const res = await calendar.events.list({
    calendarId: 'primary',
    timeMin,
    timeMax,
    timeZone: tz,
    singleEvents: true,
    orderBy: 'startTime',
    maxResults: 50,
  })

  return (res.data.items || []).map((e) => {
    const start = e.start?.dateTime || e.start?.date || ''
    const end = e.end?.dateTime || e.end?.date || ''
    const durationMs =
      start && end ? new Date(end).getTime() - new Date(start).getTime() : 0
    return {
      id: e.id || '',
      summary: e.summary || '(Sem título)',
      start,
      end,
      duration_min: Math.round(durationMs / 60000),
      attendees_count: (e.attendees || []).length,
      location: e.location || null,
      meet_link: e.hangoutLink || null,
      status: e.status || 'confirmed',
    }
  })
}

/**
 * Cria evento no calendário da closer.
 * Inclui Google Meet, manda invite pros attendees (lead recebe email)
 * e configura lembrete por email 2h antes + popup 15 min antes.
 */
export async function createEvent(
  closerEmail: string,
  event: {
    title: string
    description: string
    date: string       // YYYY-MM-DD
    timeStart: string  // HH:mm
    timeEnd: string    // HH:mm
    leadEmail?: string
  }
): Promise<{ eventId: string | null; meetLink: string | null }> {
  const calendar = getCalendarClient(closerEmail)
  const tz = 'America/Sao_Paulo'

  const attendees: calendar_v3.Schema$EventAttendee[] = [
    { email: closerEmail },
  ]
  if (event.leadEmail) {
    attendees.push({ email: event.leadEmail })
  }

  // requestId único pra cada createRequest — Google usa pra dedup
  const requestId = `aja-${event.date}-${event.timeStart}-${Math.random().toString(36).slice(2, 10)}`

  const res = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all', // dispara email de invite pros attendees (lead incluído)
    requestBody: {
      summary: event.title,
      description: event.description,
      start: {
        dateTime: `${event.date}T${event.timeStart}:00`,
        timeZone: tz,
      },
      end: {
        dateTime: `${event.date}T${event.timeEnd}:00`,
        timeZone: tz,
      },
      attendees,
      conferenceData: {
        createRequest: {
          requestId,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      },
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 120 }, // 2h antes
          { method: 'popup', minutes: 15 },
        ],
      },
    },
  })

  // Prioriza hangoutLink, cai pro primeiro entryPoint se vazio
  const meetLink =
    res.data.hangoutLink ||
    res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ||
    null

  return {
    eventId: res.data.id || null,
    meetLink,
  }
}

/**
 * Computa slots disponíveis dado working_hours, busy periods, duração e buffer.
 */
export function computeAvailableSlots(
  workingHours: {
    start: string   // "09:00"
    end: string     // "19:00"
    lunch_start: string // "12:00"
    lunch_end: string   // "13:00"
    days: number[]      // [1,2,3,4,5]
  },
  busyPeriods: { start: string; end: string }[],
  date: string,       // YYYY-MM-DD
  durationMin: number, // 30 ou 60
  bufferMin: number    // 15
): string[] {
  // Verificar se é dia útil
  const dayOfWeek = new Date(`${date}T12:00:00-03:00`).getDay()
  // JS: 0=Dom, 1=Seg... mas working_hours.days usa 1=Seg, ..., 5=Sex
  // Converter: JS 0=Dom→7, 1=Seg→1, ..., 6=Sab→6
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek
  if (!workingHours.days.includes(isoDay)) return []

  // Parse busy periods pra minutos desde meia-noite
  const busyMins = busyPeriods.map((b) => {
    const startDate = new Date(b.start)
    const endDate = new Date(b.end)
    return {
      start: startDate.getHours() * 60 + startDate.getMinutes(),
      end: endDate.getHours() * 60 + endDate.getMinutes(),
    }
  })

  // Working hours em minutos
  const [whStartH, whStartM] = workingHours.start.split(':').map(Number)
  const [whEndH, whEndM] = workingHours.end.split(':').map(Number)
  const [lunchStartH, lunchStartM] = workingHours.lunch_start.split(':').map(Number)
  const [lunchEndH, lunchEndM] = workingHours.lunch_end.split(':').map(Number)

  const whStart = whStartH * 60 + whStartM
  const whEnd = whEndH * 60 + whEndM
  const lunchStart = lunchStartH * 60 + lunchStartM
  const lunchEnd = lunchEndH * 60 + lunchEndM

  // Gerar slots candidatos
  const slots: string[] = []
  for (let t = whStart; t + durationMin <= whEnd; t += 30) {
    const slotStart = t
    const slotEnd = t + durationMin

    // Pular se cruza almoço
    if (slotStart < lunchEnd && slotEnd > lunchStart) continue

    // Pular se cruza algum período ocupado (com buffer)
    const blocked = busyMins.some((b) => {
      const bStart = b.start - bufferMin
      const bEnd = b.end + bufferMin
      return slotStart < bEnd && slotEnd > bStart
    })
    if (blocked) continue

    // Se é hoje, pular horários que já passaram
    const now = new Date()
    const todayStr = now.toLocaleDateString('sv-SE') // YYYY-MM-DD
    if (date === todayStr) {
      const nowMin = now.getHours() * 60 + now.getMinutes()
      if (slotStart <= nowMin + 30) continue // pelo menos 30 min de antecedência
    }

    // Formatar HH:mm
    const h = String(Math.floor(slotStart / 60)).padStart(2, '0')
    const m = String(slotStart % 60).padStart(2, '0')
    slots.push(`${h}:${m}`)
  }

  return slots
}
