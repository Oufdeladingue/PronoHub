import { NextRequest, NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email/send'
import { ADMIN_EMAIL } from '@/lib/email/admin-templates'

export async function POST(request: NextRequest) {
  try {
    const { name, email, company, participants, message, type } = await request.json()

    if (!name || !email || !message) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    const isEnterprise = type === 'enterprise'
    const subject = isEnterprise
      ? `[Entreprise] Demande de ${name} (${company || 'N/A'})`
      : `[Contact] Message de ${name}`

    const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff9900;">${isEnterprise ? 'Demande Entreprise' : 'Message de contact'}</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 8px 0; font-weight: bold;">Nom</td><td>${name}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold;">Email</td><td><a href="mailto:${email}">${email}</a></td></tr>
          ${isEnterprise ? `<tr><td style="padding: 8px 0; font-weight: bold;">Entreprise</td><td>${company}</td></tr>` : ''}
          ${isEnterprise ? `<tr><td style="padding: 8px 0; font-weight: bold;">Participants</td><td>${participants}</td></tr>` : ''}
          <tr><td style="padding: 8px 0; font-weight: bold;">Type</td><td>${type || 'general'}</td></tr>
        </table>
        <hr style="margin: 16px 0; border-color: #333;">
        <div style="white-space: pre-wrap; background: #f5f5f5; padding: 16px; border-radius: 8px;">${message}</div>
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
