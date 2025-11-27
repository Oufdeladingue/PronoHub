import { Resend } from 'resend'

// Instance Resend singleton
const resend = new Resend(process.env.RESEND_API_KEY)

export default resend

// Configuration email
export const EMAIL_CONFIG = {
  from: 'PronoHub <noreply@pronohub.club>',
  replyTo: 'contact@pronohub.club',
}
