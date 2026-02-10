import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import Footer from '@/components/Footer'

export const metadata: Metadata = {
  title: 'Conditions Générales de Vente - PronoHub Football',
  description: 'Consultez les conditions générales de vente et d\'utilisation de PronoHub, l\'application de pronostics football entre amis.',
  alternates: {
    canonical: 'https://www.pronohub.club/cgv',
  },
  robots: {
    index: true,
    follow: false,
  },
}

export default function CGVPage() {
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
            Conditions Générales d'Utilisation
          </h1>
          <p className="text-gray-400">
            Dernière mise à jour : 24 novembre 2025
          </p>
        </div>

        {/* Content */}
        <div className="prose prose-invert prose-orange max-w-none space-y-8">
          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">1. Objet</h2>
            <p className="text-gray-300 leading-relaxed">
              Les présentes Conditions Générales d'Utilisation (CGU) régissent l'utilisation du site PronoHub,
              une plateforme de pronostics sportifs à but ludique. En accédant au site, vous acceptez
              sans réserve les présentes conditions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">2. Description du service</h2>
            <p className="text-gray-300 leading-relaxed">
              PronoHub est une plateforme permettant aux utilisateurs de :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Créer et rejoindre des tournois de pronostics sportifs</li>
              <li>Prédire les résultats de matchs de football</li>
              <li>Consulter des classements entre amis ou collègues</li>
              <li>Gagner des trophées virtuels et suivre leurs statistiques</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              <strong className="text-white">Important :</strong> PronoHub est un jeu de pronostics gratuit sans enjeu financier.
              Aucun gain monétaire ne peut être obtenu via la plateforme.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">3. Accès au service</h2>
            <p className="text-gray-300 leading-relaxed">
              L'accès à PronoHub est réservé aux personnes majeures (18 ans et plus).
              En utilisant ce site, vous confirmez avoir l'âge légal requis.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              L'inscription nécessite une adresse email valide et la création d'un compte utilisateur.
              Vous êtes responsable de la confidentialité de vos identifiants de connexion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">4. Formules et tarifs</h2>
            <p className="text-gray-300 leading-relaxed">
              PronoHub propose plusieurs formules :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li><strong className="text-white">Gratuit :</strong> Accès limité avec 3 tournois maximum et 10 joueurs par tournoi</li>
              <li><strong className="text-white">One-Shot :</strong> Paiement unique pour un tournoi premium</li>
              <li><strong className="text-white">Joueur-clé :</strong> Abonnement mensuel ou annuel avec fonctionnalités étendues</li>
              <li><strong className="text-white">Entreprise :</strong> Solution sur mesure pour les grandes organisations</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              Les paiements sont sécurisés et gérés par Stripe. Les prix affichés sont TTC.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">5. Droit de rétractation</h2>
            <p className="text-gray-300 leading-relaxed">
              Conformément à l'article L221-28 du Code de la consommation, le droit de rétractation
              ne peut être exercé pour les services pleinement exécutés avant la fin du délai de rétractation
              et dont l'exécution a commencé après accord préalable exprès du consommateur.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              En souscrivant à une offre payante, vous reconnaissez et acceptez que le service
              commence immédiatement après validation du paiement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">6. Résiliation</h2>
            <p className="text-gray-300 leading-relaxed">
              Vous pouvez résilier votre abonnement à tout moment depuis votre espace client.
              La résiliation prendra effet à la fin de la période en cours. Aucun remboursement
              au prorata ne sera effectué.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">7. Comportement des utilisateurs</h2>
            <p className="text-gray-300 leading-relaxed">
              Les utilisateurs s'engagent à :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Respecter les autres utilisateurs et ne pas tenir de propos injurieux</li>
              <li>Ne pas utiliser de pseudonymes offensants</li>
              <li>Ne pas tenter de manipuler les résultats ou le système</li>
              <li>Ne pas utiliser le service à des fins commerciales non autorisées</li>
            </ul>
            <p className="text-gray-300 leading-relaxed mt-4">
              PronoHub se réserve le droit de suspendre ou supprimer tout compte en cas de violation
              de ces règles, sans préavis ni remboursement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">8. Propriété intellectuelle</h2>
            <p className="text-gray-300 leading-relaxed">
              L'ensemble du contenu du site PronoHub (logos, textes, graphismes, fonctionnalités)
              est protégé par le droit d'auteur. Toute reproduction non autorisée est interdite.
            </p>
            <p className="text-gray-300 leading-relaxed mt-2">
              Les logos des compétitions et équipes sportives appartiennent à leurs propriétaires respectifs
              et sont utilisés à titre informatif uniquement.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">9. Protection des données</h2>
            <p className="text-gray-300 leading-relaxed">
              PronoHub collecte et traite vos données personnelles conformément au RGPD.
              Pour plus d'informations, consultez notre{' '}
              <Link href="/privacy" className="text-[#ff9900] hover:underline">
                Politique de confidentialité
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">10. Limitation de responsabilité</h2>
            <p className="text-gray-300 leading-relaxed">
              PronoHub ne saurait être tenu responsable :
            </p>
            <ul className="list-disc list-inside text-gray-300 mt-2 space-y-1">
              <li>Des interruptions de service ou bugs techniques</li>
              <li>De l'exactitude des données sportives affichées</li>
              <li>Des décisions prises par les utilisateurs sur la base de leurs pronostics</li>
              <li>Des pertes de données en cas de force majeure</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">11. Modification des CGU</h2>
            <p className="text-gray-300 leading-relaxed">
              PronoHub se réserve le droit de modifier les présentes CGU à tout moment.
              Les utilisateurs seront informés de toute modification importante par email
              ou notification sur le site.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">12. Droit applicable</h2>
            <p className="text-gray-300 leading-relaxed">
              Les présentes CGU sont soumises au droit français. En cas de litige,
              les tribunaux français seront seuls compétents.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[#ff9900] mb-4">13. Contact</h2>
            <p className="text-gray-300 leading-relaxed">
              Pour toute question relative aux présentes CGU, vous pouvez nous contacter via notre{' '}
              <Link href="/contact" className="text-[#ff9900] hover:underline">
                formulaire de contact
              </Link>.
            </p>
          </section>
        </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
