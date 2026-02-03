'use client'

import Link from 'next/link'
import { ArrowLeft, Trophy, Users, Zap, Heart, Target, Shield } from 'lucide-react'
import Footer from '@/components/Footer'

export default function AboutPage() {
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
          <div className="text-center">
            <img
              src="/images/logo.svg"
              alt="PronoHub"
              className="w-24 h-24 mx-auto mb-6"
            />
            <h1 className="text-3xl md:text-4xl font-bold mb-4">
              À propos de PronoHub
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              La plateforme de pronostics entre amis qui transforme chaque match en moment de partage.
            </p>
          </div>
        </div>

        {/* Story Section */}
        <div className="bg-gray-800/50 rounded-2xl p-8 mb-12 border border-gray-700">
          <h2 className="text-2xl font-bold text-[#ff9900] mb-4">Notre histoire</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            PronoHub est né d'une passion commune : le football et les soirées entre amis.
            Comme beaucoup, nous passions nos week-ends à parier virtuellement sur les matchs,
            à tenir des classements sur des feuilles Excel, et à argumenter sur qui avait vraiment
            prédit le bon score.
          </p>
          <p className="text-gray-300 leading-relaxed mb-4">
            Fatigués de perdre nos données, de jongler entre groupes WhatsApp et tableurs,
            nous avons décidé de créer <strong className="text-white">l'outil dont nous rêvions</strong> :
            une plateforme simple, fun et complète pour organiser des tournois de pronostics.
          </p>
          <p className="text-gray-300 leading-relaxed">
            Aujourd'hui, PronoHub permet à des milliers de passionnés de vivre leur passion
            du football autrement, en créant des moments de complicité avec leurs proches.
          </p>
        </div>

        {/* Values Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-center mb-8">Nos valeurs</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <ValueCard
              icon={<Users className="w-8 h-8" />}
              title="Convivialité"
              description="Le football est un sport de partage. PronoHub renforce les liens entre amis, collègues et passionnés."
            />
            <ValueCard
              icon={<Zap className="w-8 h-8" />}
              title="Simplicité"
              description="Interface intuitive, inscription rapide, pronostics en quelques clics. On va droit au but."
            />
            <ValueCard
              icon={<Shield className="w-8 h-8" />}
              title="Fair-play"
              description="Pas d'argent réel, pas de paris. Juste la gloire et les trophées virtuels pour le fun."
            />
          </div>
        </div>

        {/* Features Highlight */}
        <div className="bg-gradient-to-r from-[#ff9900]/10 to-orange-600/10 rounded-2xl p-8 mb-12 border border-[#ff9900]/30">
          <h2 className="text-2xl font-bold text-center mb-8">Pourquoi PronoHub ?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <FeatureItem
              icon={<Trophy className="w-6 h-6 text-[#ff9900]" />}
              title="Trophées et récompenses"
              description="Plus de 20 trophées à débloquer : Roi du doublé, Nostradamus, Remontada... Devenez une légende !"
            />
            <FeatureItem
              icon={<Target className="w-6 h-6 text-[#ff9900]" />}
              title="Règles personnalisables"
              description="Score exact, bon vainqueur, bonus... Créez vos propres règles de scoring."
            />
            <FeatureItem
              icon={<Users className="w-6 h-6 text-[#ff9900]" />}
              title="Tournois privés"
              description="Invitez vos amis avec un simple code. Votre tournoi, vos règles."
            />
            <FeatureItem
              icon={<Heart className="w-6 h-6 text-[#ff9900]" />}
              title="100% passion"
              description="Développé par des fans de foot, pour des fans de foot."
            />
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Prêt à relever le défi ?</h2>
          <p className="text-gray-400 mb-8">
            Rejoignez la communauté PronoHub et montrez que vous êtes le meilleur pronostiqueur !
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="px-8 py-4 bg-[#ff9900] hover:bg-[#e68a00] text-black font-bold rounded-lg transition-all transform hover:scale-105"
            >
              Créer un compte
            </Link>
            <Link
              href="/pricing"
              className="px-8 py-4 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-all"
            >
              Voir les offres
            </Link>
          </div>
        </div>

        </div>
      </div>
      <Footer />
    </div>
  )
}

function ValueCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700 text-center">
      <div className="w-16 h-16 bg-[#ff9900]/20 rounded-full flex items-center justify-center mx-auto mb-4 text-[#ff9900]">
        {icon}
      </div>
      <h3 className="text-lg font-bold mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  )
}

function FeatureItem({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center flex-shrink-0">
        {icon}
      </div>
      <div>
        <h3 className="font-bold mb-1">{title}</h3>
        <p className="text-gray-400 text-sm">{description}</p>
      </div>
    </div>
  )
}
