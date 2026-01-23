import { NextResponse } from 'next/server'
import { sendInactiveUserReminderEmail } from '@/lib/email/send'

// TEMPORAIRE - Supprimer après test
export async function GET() {
  const result = await sendInactiveUserReminderEmail('kochroman6@gmail.com', {
    username: 'Roman'
  })

  return NextResponse.json(result)
}
