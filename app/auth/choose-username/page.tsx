import { redirect } from 'next/navigation'

// La page choose-username est remplacée par une modale sur le dashboard.
// Cette page redirige pour les anciens liens (emails, bookmarks).
export default function ChooseUsernamePage() {
  redirect('/dashboard')
}
