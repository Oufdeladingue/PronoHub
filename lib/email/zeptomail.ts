/**
 * Client ZeptoMail (API REST, région UE) pour l'envoi d'emails transactionnels.
 *
 * Remplace/complète Resend. Le fournisseur actif est piloté par EMAIL_PROVIDER (cf. send.ts).
 * Auth : header `Authorization: Zoho-enczapikey <token>` (la variable ZEPTOMAIL_API_KEY peut
 * contenir le token brut ou la chaîne complète déjà préfixée).
 */
const ZEPTOMAIL_ENDPOINT = 'https://api.zeptomail.eu/v1.1/email'

export interface ZeptoSendParams {
  fromAddress: string
  fromName?: string
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  headers?: Record<string, string>
}

export async function sendViaZeptoMail(p: ZeptoSendParams): Promise<{ id?: string }> {
  const raw = process.env.ZEPTOMAIL_API_KEY
  if (!raw) throw new Error('ZEPTOMAIL_API_KEY is not configured')
  const authorization = raw.startsWith('Zoho-enczapikey') ? raw : `Zoho-enczapikey ${raw}`

  const body: Record<string, any> = {
    from: { address: p.fromAddress, name: p.fromName },
    to: [{ email_address: { address: p.to } }],
    subject: p.subject,
    htmlbody: p.html,
  }
  if (p.text) body.textbody = p.text
  if (p.replyTo) body.reply_to = [{ address: p.replyTo }]
  // En-têtes custom (ex : List-Unsubscribe one-click) via mime_headers
  if (p.headers && Object.keys(p.headers).length > 0) body.mime_headers = p.headers

  const res = await fetch(ZEPTOMAIL_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: authorization,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const err: any = new Error(`ZeptoMail ${res.status}: ${detail.slice(0, 300)}`)
    err.status = res.status
    throw err
  }

  const data: any = await res.json().catch(() => ({}))
  // ZeptoMail renvoie un request_id (et des message-id par destinataire dans data.data)
  const id = data?.request_id || data?.data?.[0]?.additional_info?.[0]?.['message-id'] || undefined
  return { id }
}
