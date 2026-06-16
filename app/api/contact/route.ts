import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { ADMIN_EMAIL } from '@/lib/email/admin-templates'
import { checkRateLimit, getClientIP } from '@/lib/rate-limit'

// Échappe les caractères HTML pour empêcher l'injection dans le template de l'email admin
function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function POST(request: NextRequest) {
  try {
    // Rate limit par IP (endpoint public → anti-spam de la boîte admin)
    const ip = getClientIP(request)
    const rate = checkRateLimit(`contact:${ip}`, { limit: 3, windowMs: 10 * 60 * 1000 })
    if (!rate.success) {
      return NextResponse.json({ error: 'Trop de messages. Réessayez dans quelques minutes.' }, { status: 429 })
    }

    const { name, email, company, participants, message, type } = await request.json()

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    // Validation : format email + bornes de longueur
    if (typeof email !== 'string' || !EMAIL_RE.test(email) || email.length > 254) {
      return NextResponse.json({ error: 'Email invalide' }, { status: 400 })
    }
    if (String(name).length > 100 || String(message).length > 5000) {
      return NextResponse.json({ error: 'Champs trop longs' }, { status: 400 })
    }

    const isEnterprise = type === 'enterprise'
    // Valeurs échappées pour le HTML (anti-injection)
    const eName = escapeHtml(name)
    const eEmail = escapeHtml(email)
    const eCompany = escapeHtml(company)
    const eParticipants = escapeHtml(participants)
    const eMessage = escapeHtml(message)
    const eType = escapeHtml(type || 'general')
    // Sujet : pas de retour à la ligne (anti header-injection)
    const safeSubjectName = String(name).replace(/[\r\n]+/g, ' ').slice(0, 100)
    const safeSubjectCompany = String(company || 'N/A').replace(/[\r\n]+/g, ' ').slice(0, 100)
    const subject = isEnterprise
      ? `[Entreprise] Demande de ${safeSubjectName} (${safeSubjectCompany})`
      : `[Contact] Message de ${safeSubjectName}`

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff9900;">${isEnterprise ? 'Demande Entreprise' : 'Message de contact'}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold;">Nom</td><td>${eName}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Email</td><td><a href="mailto:${eEmail}">${eEmail}</a></td></tr>
          ${isEnterprise ? `<tr><td style="padding: 8px 0; font-weight: bold;">Entreprise</td><td>${eCompany}</td></tr>` : ''}
          ${isEnterprise ? `<tr><td style="padding: 8px 0; font-weight: bold;">Participants</td><td>${eParticipants}</td></tr>` : ''}
          <tr><td style="padding: 8px 0; font-weight: bold;">Type</td><td>${eType}</td></tr>
        </table>
        <hr style="margin: 16px 0; border-color: #333;">
        <div style="white-space: pre-wrap; background: #f5f5f5; padding: 16px; border-radius: 8px;">${eMessage}</div>
      </div>
    `

    const text = `${isEnterprise ? 'Demande Entreprise' : 'Message de contact'}\n\nNom: ${name}\nEmail: ${email}${isEnterprise ? `\nEntreprise: ${company}\nParticipants: ${participants}` : ''}\nType: ${type || 'general'}\n\nMessage:\n${message}`

    const result = await sendEmail(ADMIN_EMAIL, subject, html, text)

    if (!result.success) {
      return NextResponse.json({ error: 'Erreur lors de l\'envoi' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[CONTACT] Error:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}
