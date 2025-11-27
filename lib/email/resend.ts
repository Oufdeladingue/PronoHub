import { Resend } from 'resend'

// Instance Resend singleton - créé à la demande pour éviter les erreurs au build
let resendInstance: Resend | null = null

function getResendInstance(): Resend {
  if (!resendInstance) {
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is not configured')
    }
    resendInstance = new Resend(apiKey)
  }
  return resendInstance
}

export default {
  get emails() {
    return getResendInstance().emails
  }
}

// Configuration email
export const EMAIL_CONFIG = {
  from: 'PronoHub <noreply@pronohub.club>',
  replyTo: 'contact@pronohub.club',
}
