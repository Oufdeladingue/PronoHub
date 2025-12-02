'use client'

import { XCircle } from 'lucide-react'
import Link from 'next/link'

export default function PaymentCancelPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 theme-bg">
      <div className="max-w-md w-full theme-card p-8 text-center">
        <XCircle className="w-16 h-16 mx-auto mb-4 text-orange-500" />
        <h1 className="text-xl font-bold theme-text mb-2">Paiement annulé</h1>
        <p className="theme-text-secondary mb-6">
          Votre paiement a été annulé. Aucun montant n'a été débité.
        </p>

        <div className="space-y-3">
          <Link
            href="/profile"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 bg-[#ff9900] hover:bg-[#e68a00] text-white font-semibold rounded-lg transition-colors"
          >
            Retour à mon profil
          </Link>

          <Link
            href="/pricing"
            className="flex items-center justify-center gap-2 w-full py-3 px-4 theme-bg-secondary hover:opacity-80 theme-text font-semibold rounded-lg transition-colors"
          >
            Voir les offres
          </Link>
        </div>
      </div>
    </div>
  )
}
