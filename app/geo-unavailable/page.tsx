import Link from 'next/link'
import { getCountryByCode } from '@/lib/countries'

export const metadata = {
  title: 'Bientôt chez toi — PronoHub',
  robots: { index: false, follow: false },
}

/**
 * Écran affiché aux visiteurs dont le pays n'est pas (encore) ouvert.
 * Remplace l'ancien `signOut` + redirect brutal vers /auth/signup?error=.
 * Ton football décalé, pas anxiogène : « on n'a pas encore sifflé le coup d'envoi chez toi ».
 */
export default async function GeoUnavailablePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { c } = await searchParams
  const country = c ? getCountryByCode(c.toUpperCase()) : undefined

  return (
    <div className="min-h-screen bg-[#0f172a] text-white flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center">
        <img
          src="/images/logo.png"
          alt="PronoHub"
          className="h-12 mx-auto mb-10 opacity-90"
        />

        <div className="text-6xl mb-4">🌍<span className="mx-1">⚽</span></div>

        {country && (
          <p className="text-lg font-semibold text-white/85 mb-2">{country.name}</p>
        )}

        <h1 className="text-2xl font-bold text-[#ff9900] mb-4 leading-snug">
          On n'a pas encore sifflé le coup d'envoi chez toi
        </h1>

        <p className="text-slate-300 text-[15px] leading-relaxed mb-3">
          PronoHub se déploie <strong className="text-white">pays par pays</strong>. Pour l'instant, le terrain
          n'est ouvert qu'en France, dans les DOM-TOM et quelques pays voisins.
        </p>
        <p className="text-slate-300 text-[15px] leading-relaxed mb-8">
          Ton compte n'a <strong className="text-white">pas</strong> été créé — mais dès qu'on ouvre chez toi,
          tu pourras entrer sur la pelouse en un clic. 🟢
        </p>

        <Link
          href="/"
          className="inline-block bg-[#ff9900] text-[#111827] font-bold text-[16px] px-8 py-3.5 rounded-xl hover:brightness-110 transition"
        >
          Retour à l'accueil
        </Link>

        <p className="text-slate-500 text-xs mt-8">
          Une question ? Écris-nous à{' '}
          <a href="mailto:contact@pronohub.club" className="text-slate-400 underline">
            contact@pronohub.club
          </a>
        </p>
      </div>
    </div>
  )
}
