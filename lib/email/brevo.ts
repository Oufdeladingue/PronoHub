/**
 * Client Brevo (ex-Sendinblue) — API REST transactionnelle.
 *
 * Brevo autorise À LA FOIS le transactionnel ET le marketing (contrairement à ZeptoMail qui
 * refuse le promotionnel). Fournisseur actif piloté par EMAIL_PROVIDER (cf. send.ts).
 * Auth : header `api-key: <BREVO_API_KEY>`.
 * Doc : https://developers.brevo.com/reference/sendtransacemail
 */
const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export interface BrevoSendParams {
  fromAddress: string
  fromName?: string
  to: string
  subject: string
  html: string
  text?: string
  replyTo?: string
  headers?: Record<string, string>
}

export async function sendViaBrevo(p: BrevoSendParams): Promise<{ id?: string }> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) throw new Error('BREVO_API_KEY is not configured')

  const body: Record<string, any> = {
    sender: { email: p.fromAddress, name: p.fromName },
    to: [{ email: p.to }],
    subject: p.subject,
    htmlContent: p.html,
  }
  if (p.text) body.textContent = p.text
  if (p.replyTo) body.replyTo = { email: p.replyTo }
  // En-têtes custom (ex : List-Unsubscribe one-click)
  if (p.headers && Object.keys(p.headers).length > 0) body.headers = p.headers

  const res = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    const err: any = new Error(`Brevo ${res.status}: ${detail.slice(0, 300)}`)
    err.status = res.status
    throw err
  }

  const data: any = await res.json().catch(() => ({}))
  return { id: data?.messageId }
}
