import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Politique de Confidentialité - PronoHub Football',
  description: 'Découvrez comment PronoHub protège vos données personnelles. Notre politique de confidentialité détaille la collecte et l\'utilisation de vos informations.',
  alternates: {
    canonical: 'https://www.pronohub.club/privacy',
  },
  robots: {
    index: true,
    follow: false,
  },
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1 bg-gradient-to-b from-gray-900 to-gray-800 text-white py-16 px-4">
        <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour à l'accueil
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            Politique de Confidentialité et Cookies
          </h1>
          <p className="text-gray-400">
            Dernière mise à jour : 4 février 2026
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-orange max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">1. Introduction</h2>
            <p className="text-gray-300 leading-relaxed">
              PronoHub s'engage à protéger la vie privée de ses utilisateurs.
              Cette politique explique comment nous collectons, utilisons et protégeons vos données personnelles,
              conformément au Règlement Général sur la Protection des Données (RGPD).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">2. Données collectées</h2>
            <p className="text-gray-300 leading-relaxed">
              Nous collectons les données suivantes :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li><strong className="text-white">Données d'inscription :</strong> Email, nom d'utilisateur, avatar</li>
              <li><strong className="text-white">Données d'utilisation :</strong> Pronostics, scores, trophées, statistiques de jeu</li>
              <li><strong className="text-white">Données techniques :</strong> Adresse IP, type de navigateur, préférences (thème clair/sombre)</li>
              <li><strong className="text-white">Données de paiement :</strong> Gérées exclusivement par Stripe (nous ne stockons pas vos coordonnées bancaires)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">3. Finalité du traitement</h2>
            <p className="text-gray-300 leading-relaxed">
              Vos données sont utilisées pour :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Gérer votre compte et authentifier vos connexions</li>
              <li>Faire fonctionner les tournois de pronostics</li>
              <li>Calculer et afficher les classements</li>
              <li>Envoyer des notifications importantes (rappels de matchs, résultats)</li>
              <li>Améliorer notre service et corriger les bugs</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">4. Base légale</h2>
            <p className="text-gray-300 leading-relaxed">
              Le traitement de vos données repose sur :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li><strong className="text-white">Exécution du contrat :</strong> Pour fournir le service de pronostics</li>
              <li><strong className="text-white">Consentement :</strong> Pour l'envoi de communications marketing (optionnel)</li>
              <li><strong className="text-white">Intérêt légitime :</strong> Pour améliorer notre service et prévenir la fraude</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">5. Cookies</h2>
            <p className="text-gray-300 leading-relaxed">
              PronoHub utilise des cookies pour :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li><strong className="text-white">Cookies essentiels :</strong> Session utilisateur, authentification, préférences de thème</li>
              <li><strong className="text-white">Cookies fonctionnels :</strong> Mémorisation de vos choix (langue, affichage)</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              Nous n'utilisons <strong className="text-white">pas</strong> de cookies publicitaires ni de traceurs tiers.
            </p>
            <div className="bg-gray-800 rounded-lg p-4 mt-4">
              <p className="text-sm text-gray-400">
                <strong className="text-white">Gestion des cookies :</strong> En acceptant notre bandeau d'entrée,
                vous consentez à l'utilisation des cookies essentiels. Vous pouvez les supprimer à tout moment
                via les paramètres de votre navigateur.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">6. Conservation des données</h2>
            <p className="text-gray-300 leading-relaxed">
              Vos données sont conservées :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li><strong className="text-white">Compte actif :</strong> Tant que votre compte existe</li>
              <li><strong className="text-white">Compte supprimé :</strong> 30 jours après suppression (pour permettre la récupération)</li>
              <li><strong className="text-white">Données de paiement :</strong> Selon les obligations légales (10 ans pour les factures)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">7. Vos droits</h2>
            <p className="text-gray-300 leading-relaxed">
              Conformément au RGPD, vous disposez des droits suivants :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li><strong className="text-white">Droit d'accès :</strong> Obtenir une copie de vos données</li>
              <li><strong className="text-white">Droit de rectification :</strong> Corriger vos informations</li>
              <li><strong className="text-white">Droit à l'effacement :</strong> Supprimer votre compte et vos données</li>
              <li><strong className="text-white">Droit à la portabilité :</strong> Récupérer vos données dans un format exploitable</li>
              <li><strong className="text-white">Droit d'opposition :</strong> Refuser certains traitements</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              Pour exercer ces droits, contactez-nous via notre{' '}
              <Link href="/contact" className="text-[#ff9900] hover:underline">
                formulaire de contact
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">8. Sécurité</h2>
            <p className="text-gray-300 leading-relaxed">
              Nous mettons en œuvre des mesures de sécurité appropriées :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Connexion sécurisée HTTPS</li>
              <li>Mots de passe hashés et salés</li>
              <li>Authentification sécurisée via Supabase</li>
              <li>Paiements gérés par Stripe (certifié PCI-DSS)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">9. Partage des données</h2>
            <p className="text-gray-300 leading-relaxed">
              Vos données ne sont <strong className="text-white">jamais vendues</strong>. Elles peuvent être partagées avec :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li><strong className="text-white">Supabase :</strong> Hébergement de la base de données (serveurs UE)</li>
              <li><strong className="text-white">Stripe :</strong> Traitement des paiements</li>
              <li><strong className="text-white">Hetzner :</strong> Hébergement du site web (serveurs UE)</li>
              <li><strong className="text-white">Google :</strong> Authentification via Google Sign-In</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              Ces prestataires sont conformes au RGPD et traitent vos données uniquement selon nos instructions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">10. Mineurs</h2>
            <p className="text-gray-300 leading-relaxed">
              PronoHub est réservé aux personnes majeures (18 ans et plus).
              Nous ne collectons pas sciemment de données concernant des mineurs.
              Si vous êtes parent et pensez que votre enfant a créé un compte,
              contactez-nous pour le faire supprimer.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">11. Modifications</h2>
            <p className="text-gray-300 leading-relaxed">
              Cette politique peut être mise à jour. En cas de modification substantielle,
              vous serez informé par email ou notification sur le site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">12. Contact DPO</h2>
            <p className="text-gray-300 leading-relaxed">
              Pour toute question relative à vos données personnelles,
              vous pouvez contacter notre Délégué à la Protection des Données via notre{' '}
              <Link href="/contact" className="text-[#ff9900] hover:underline">
                formulaire de contact
              </Link>.
            </p>
            <p className="text-gray-300 leading-relaxed mt-4">
              Si vous estimez que vos droits ne sont pas respectés, vous pouvez introduire
              une réclamation auprès de la CNIL (Commission Nationale de l'Informatique et des Libertés).
            </p>
          </section>
        </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
