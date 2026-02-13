import Link from 'next/link'
import Image from 'next/image'
import { AuthRedirect } from './AuthRedirect'

export const metadata = {
  title: 'PronoHub - Tournois de Pronostics Football entre Amis',
  description: 'Cree ton tournoi de pronostics, invite tes potes et prouve que tu es le roi du prono. Gratuit, sans pub, 100% fun.',
}

// ============================================
// SECTION 1 — HERO
// ============================================
function HeroSection() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 py-16 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />

      {/* Glow effect derriere le logo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#ff9900]/10 rounded-full blur-[120px]" />

      <div className="relative z-10 text-center max-w-2xl mx-auto space-y-6">
        {/* Logo + Couronne */}
        <div className="flex flex-col items-center">
          <Image
            src="/images/king.svg"
            alt="Couronne PronoHub"
            width={140}
            height={140}
            className="h-auto mb-2 drop-shadow-[0_0_60px_rgba(255,220,150,0.7)]"
            priority
          />
          <Image
            src="/images/logo.svg"
            alt="PronoHub"
            width={160}
            height={160}
            className="w-auto drop-shadow-[0_0_100px_rgba(255,220,150,0.6)]"
            style={{ height: '6rem' }}
            priority
          />
        </div>

        {/* Titre principal */}
        <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
          Fais-toi plaisir,<br />
          deviens le <span className="text-[#ff9900]">roi du prono</span>.
        </h1>

        {/* Sous-titre */}
        <p className="text-lg md:text-xl text-gray-300 max-w-lg mx-auto">
          Cree un tournoi, invite tes potes, pronostique les matchs et prouve que t'es le meilleur.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-4">
          <Link
            href="/auth/signup"
            className="font-semibold text-base rounded-lg px-8 py-3.5 bg-[#ff9900] text-[#1a1a1a] shadow-[0_0_20px_rgba(255,153,0,0.4)] hover:bg-[#e68a00] hover:shadow-[0_0_30px_rgba(255,153,0,0.6)] hover:-translate-y-0.5 transition-all duration-300 w-56 text-center"
          >
            Creer mon tournoi
          </Link>
          <Link
            href="/auth/login"
            className="font-semibold text-base rounded-lg px-8 py-3.5 bg-white/10 text-white border border-white/20 hover:bg-white/20 hover:-translate-y-0.5 transition-all duration-300 w-56 text-center"
          >
            Se connecter
          </Link>
        </div>

        {/* Badge gratuit */}
        <p className="text-sm text-gray-400 pt-2">
          Gratuit, sans pub, inscription en 30 secondes
        </p>
      </div>

      {/* Fleche scroll down */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  )
}

// ============================================
// SECTION 2 — COMMENT CA MARCHE (3 etapes)
// ============================================
function HowItWorksSection() {
  const steps = [
    {
      number: '1',
      title: 'Cree ton tournoi',
      description: 'Choisis ta competition (Ligue 1, Champions League, Best of Week...) et configure les regles.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      number: '2',
      title: 'Invite tes potes',
      description: 'Partage le code du tournoi et constitue ton equipe. Plus on est de fous, plus on rit.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      number: '3',
      title: 'Pronostique et grimpe',
      description: 'Score exact = 3 pts, bon resultat = 1 pt. Decroche des trophees et deviens le roi.',
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ]

  return (
    <section className="px-4 py-20 md:py-28 bg-gray-950">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          Comment ca marche ?
        </h2>
        <p className="text-gray-400 text-center mb-16 max-w-lg mx-auto">
          En 3 etapes, tu passes de spectateur a roi du prono.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
          {steps.map((step) => (
            <div key={step.number} className="relative text-center group">
              {/* Numero */}
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#ff9900]/10 border border-[#ff9900]/20 text-[#ff9900] mb-6 group-hover:bg-[#ff9900]/20 transition-colors duration-300">
                {step.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-gray-400 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================
// SECTION 3 — FEATURES CLES
// ============================================
function FeaturesSection() {
  const features = [
    {
      title: 'Classements en temps reel',
      description: 'Suis ton evolution et celle de tes potes a chaque journee. Qui prend la tete ?',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
        </svg>
      ),
    },
    {
      title: 'Chat entre joueurs',
      description: 'Chambre tes potes, reagis a leurs pronos, mentionne-les. Le vestiaire est chaud.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      title: '16 trophees a debloquer',
      description: 'Nostradamus, Ballon d\'Or, Roi de la journee... Collectionne-les tous.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
    },
    {
      title: 'Rappels automatiques',
      description: 'On te previent avant chaque match pour ne jamais oublier un prono.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      title: 'Competitions variees',
      description: 'Ligue 1, Premier League, Champions League, Best of Week... Il y en a pour tous les gouts.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Mobile et web',
      description: 'Joue depuis ton telephone ou ton ordi. Tes pronos se synchronisent partout.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
  ]

  return (
    <section className="px-4 py-20 md:py-28 bg-black">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl md:text-4xl font-bold text-white text-center mb-4">
          Tout pour vivre le foot a fond
        </h2>
        <p className="text-gray-400 text-center mb-16 max-w-lg mx-auto">
          PronoHub, c'est bien plus qu'un simple tableau de pronostics.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800 hover:border-[#ff9900]/30 hover:bg-gray-900/80 transition-all duration-300"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-[#ff9900]/10 text-[#ff9900] mb-4">
                {feature.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{feature.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ============================================
// SECTION 4 — SOCIAL PROOF
// ============================================
function SocialProofSection() {
  const stats = [
    { value: '100+', label: 'Tournois crees' },
    { value: '500+', label: 'Joueurs actifs' },
    { value: '10 000+', label: 'Pronostics enregistres' },
  ]

  return (
    <section className="px-4 py-20 md:py-28 bg-gray-950">
      <div className="max-w-4xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-16">
          Ils pronostiquent deja sur PronoHub
        </h2>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-16">
          {stats.map((stat) => (
            <div key={stat.label} className="space-y-2">
              <div className="text-4xl md:text-5xl font-bold text-[#ff9900]">{stat.value}</div>
              <div className="text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Placeholder temoignages — a remplacer par de vrais temoignages */}
        {/*
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <TestimonialCard name="Alex" text="On a cree un tournoi au bureau, c'est devenu le sujet n1 a la machine a cafe." />
          <TestimonialCard name="Marie" text="Les trophees rendent le truc addictif. J'ai eu le Nostradamus, je suis trop fiere." />
          <TestimonialCard name="Thomas" text="Simple, fun, et ca marche. Pas besoin de plus." />
        </div>
        */}
      </div>
    </section>
  )
}

// ============================================
// SECTION 5 — PRICING TEASER
// ============================================
function PricingTeaser() {
  return (
    <section className="px-4 py-20 md:py-28 bg-black">
      <div className="max-w-3xl mx-auto text-center">
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
          Gratuit pour commencer
        </h2>
        <p className="text-gray-400 mb-12 max-w-lg mx-auto">
          Cree jusqu'a 2 tournois gratuits avec 5 joueurs. Besoin de plus ? Nos offres s'adaptent a ta bande de potes.
        </p>

        {/* Comparatif simplifie */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto mb-12">
          {/* Free */}
          <div className="p-6 rounded-2xl bg-gray-900/50 border border-gray-800">
            <div className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Free-Kick</div>
            <div className="text-3xl font-bold text-white mb-4">0 &euro;</div>
            <ul className="space-y-3 text-sm text-gray-300 text-left">
              <li className="flex items-center gap-2">
                <span className="text-green-400">&#10003;</span> 2 tournois actifs
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">&#10003;</span> 5 joueurs max
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">&#10003;</span> Toutes les competitions
              </li>
              <li className="flex items-center gap-2">
                <span className="text-green-400">&#10003;</span> Chat et trophees
              </li>
            </ul>
          </div>

          {/* Premium */}
          <div className="p-6 rounded-2xl bg-[#ff9900]/5 border border-[#ff9900]/30">
            <div className="text-sm font-semibold text-[#ff9900] uppercase tracking-wider mb-2">Premium</div>
            <div className="text-3xl font-bold text-white mb-4">
              des 4,99 &euro;
            </div>
            <ul className="space-y-3 text-sm text-gray-300 text-left">
              <li className="flex items-center gap-2">
                <span className="text-[#ff9900]">&#10003;</span> Jusqu'a 30 joueurs
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#ff9900]">&#10003;</span> Tournois illimites
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#ff9900]">&#10003;</span> Match bonus x2
              </li>
              <li className="flex items-center gap-2">
                <span className="text-[#ff9900]">&#10003;</span> Extensions joueurs et duree
              </li>
            </ul>
          </div>
        </div>

        <Link
          href="/pricing"
          className="inline-block font-semibold text-sm text-[#ff9900] border border-[#ff9900]/30 rounded-lg px-6 py-3 hover:bg-[#ff9900]/10 transition-colors duration-300"
        >
          Voir tous les tarifs &rarr;
        </Link>
      </div>
    </section>
  )
}

// ============================================
// SECTION 6 — CTA FINAL
// ============================================
function CTASection() {
  return (
    <section className="relative px-4 py-24 md:py-32 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#ff9900]/10 via-black to-black" />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ff9900]/5 rounded-full blur-[150px]" />

      <div className="relative z-10 max-w-2xl mx-auto text-center space-y-6">
        <h2 className="text-3xl md:text-4xl font-bold text-white">
          Pret a defier tes potes ?
        </h2>
        <p className="text-gray-300 text-lg">
          Rejoins la communaute et montre-leur qui est le vrai roi du prono.
        </p>
        <div className="pt-4">
          <Link
            href="/auth/signup"
            className="inline-block font-semibold text-base rounded-lg px-10 py-4 bg-[#ff9900] text-[#1a1a1a] shadow-[0_0_30px_rgba(255,153,0,0.4)] hover:bg-[#e68a00] hover:shadow-[0_0_40px_rgba(255,153,0,0.6)] hover:-translate-y-0.5 transition-all duration-300"
          >
            Commencer gratuitement
          </Link>
        </div>
        <p className="text-sm text-gray-500">
          Pas de carte bancaire requise
        </p>
      </div>
    </section>
  )
}

// ============================================
// FOOTER
// ============================================
function LandingFooter() {
  return (
    <footer className="px-4 py-8 bg-black border-t border-gray-800">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Image src="/images/logo.svg" alt="PronoHub" width={24} height={24} className="w-6 h-6" />
            <span className="text-sm text-gray-400">PronoHub &copy; {new Date().getFullYear()}</span>
          </div>
          <nav className="flex flex-wrap justify-center gap-6 text-sm text-gray-400">
            <Link href="/about" className="hover:text-[#ff9900] transition-colors">A propos</Link>
            <Link href="/pricing" className="hover:text-[#ff9900] transition-colors">Tarifs</Link>
            <Link href="/contact" className="hover:text-[#ff9900] transition-colors">Contact</Link>
            <Link href="/cgv" className="hover:text-[#ff9900] transition-colors">CGU</Link>
            <Link href="/privacy" className="hover:text-[#ff9900] transition-colors">Confidentialite</Link>
          </nav>
        </div>
      </div>
    </footer>
  )
}

// ============================================
// PAGE PRINCIPALE (SSR)
// ============================================
export default function LandingPreview() {
  return (
    <div className="min-h-screen bg-black text-white scroll-smooth">
      {/* Composant client invisible : redirige si l'user est deja connecte */}
      <AuthRedirect />

      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <SocialProofSection />
      <PricingTeaser />
      <CTASection />
      <LandingFooter />
    </div>
  )
}
