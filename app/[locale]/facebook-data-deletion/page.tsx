import Link from 'next/link'

export const metadata = {
  title: 'Suppression des données - PronoHub',
}

export default function FacebookDataDeletionPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black">
      <div className="max-w-md w-full bg-[#111] border border-[#2f2f2f] rounded-xl p-8">
        <h1 className="text-xl font-bold text-white mb-4">
          Suppression de vos données
        </h1>
        <p className="text-gray-300 mb-4">
          Si vous souhaitez supprimer vos données associées à votre compte Facebook sur PronoHub,
          vous pouvez le faire directement depuis votre profil :
        </p>
        <ol className="list-decimal list-inside text-gray-300 space-y-2 mb-6">
          <li>Connectez-vous à votre compte PronoHub</li>
          <li>Allez dans <strong className="text-white">Profil</strong> → onglet <strong className="text-white">Sécurité</strong></li>
          <li>Cliquez sur <strong className="text-white">Gestion avancée du compte</strong></li>
          <li>Suivez les instructions pour supprimer votre compte</li>
        </ol>
        <p className="text-gray-400 text-sm mb-6">
          La suppression de votre compte entraîne la suppression définitive de toutes vos données
          personnelles, participations aux tournois et pronostics.
        </p>
        <Link
          href="/auth/login"
          className="block w-full text-center py-3 px-4 bg-[#ff9900] hover:bg-[#e68a00] text-black font-semibold rounded-lg transition-colors"
        >
          Se connecter
        </Link>
      </div>
    </div>
  )
}
