import Link from 'next/link'
import Image from 'next/image'
import { ClientShell } from './ClientShell'
import './landing.css'

export const metadata = {
  title: 'PronoHub - Tournois de Pronostics Football entre Amis',
  description: 'Crée ton tournoi de pronostics, invite tes potes et prouve que tu es le roi du prono. Gratuit, sans pub, 100% fun.',
}

// =============================================
// SECTION 1 — HERO
// =============================================
function HeroSection() {
  return (
    <section
      id="hero"
      data-chapter="Hero"
      className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-8 md:snap-start"
    >
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ff9900]/[0.06] rounded-full blur-[150px]" />

      <div className="relative z-10 text-center max-w-2xl mx-auto space-y-6">
        {/* Logo + Crown */}
        <div className="flex flex-col items-center" data-animate>
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

        {/* H1 */}
        <h1
          className="text-4xl md:text-5xl lg:text-6xl font-bold text-white leading-tight"
          data-animate
          style={{ '--stagger': '100ms' } as React.CSSProperties}
        >
          Fais-toi plaisir,<br />
          deviens le <span className="text-[#ff9900]">roi du prono</span>.
        </h1>

        {/* Subtitle */}
        <p
          className="text-lg md:text-xl text-[#94a3b8] max-w-lg mx-auto"
          data-animate
          style={{ '--stagger': '200ms' } as React.CSSProperties}
        >
          Crée un tournoi, invite tes potes, pronostique les matchs et prouve que t&apos;es le meilleur.
        </p>

        {/* CTAs */}
        <div
          className="flex flex-col sm:flex-row justify-center items-center gap-3 pt-4"
          data-animate
          style={{ '--stagger': '300ms' } as React.CSSProperties}
        >
          <Link
            href="/auth/signup"
            className="font-semibold text-base rounded-[14px] px-8 py-3.5 bg-[#ff9900] text-[#1a1a1a] shadow-[0_0_20px_rgba(255,153,0,0.4)] hover:bg-[#e68a00] hover:shadow-[0_0_30px_rgba(255,153,0,0.6)] hover:-translate-y-0.5 transition-all duration-300 w-56 text-center"
          >
            Créer mon tournoi
          </Link>
          <Link
            href="/auth/login"
            className="font-semibold text-base rounded-[14px] px-8 py-3.5 bg-white/10 text-white border border-white/[0.08] hover:bg-white/[0.15] hover:-translate-y-0.5 transition-all duration-300 w-56 text-center"
          >
            Se connecter
          </Link>
        </div>

        {/* Badge */}
        <p
          className="text-sm text-[#94a3b8] pt-2"
          data-animate
          style={{ '--stagger': '400ms' } as React.CSSProperties}
        >
          Gratuit, sans pub — inscription en 30 secondes, sans CB
        </p>
      </div>

      {/* Scroll hint */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-bounce opacity-40">
        <svg className="w-5 h-5 text-[#94a3b8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  )
}

// =============================================
// SECTION 2 — COMMENT CA MARCHE (3 etapes)
// =============================================
function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Crée ton tournoi',
      description: 'Choisis ta compétition (Ligue 1, Champions League, Best of Week...) et configure les règles.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      number: '02',
      title: 'Invite tes potes',
      description: 'Partage le code du tournoi et constitue ton équipe. Plus on est de fous, plus on rit.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      number: '03',
      title: 'Pronostique et grimpe',
      description: 'Score exact = 3 pts, bon résultat = 1 pt. Décroche des trophées et deviens le roi.',
      icon: (
        <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
      ),
    },
  ]

  return (
    <section
      id="how"
      data-chapter="Comment ça marche"
      className="min-h-screen flex items-center px-4 py-20 md:py-0 bg-[#0f1729] md:snap-start"
    >
      <div className="max-w-4xl mx-auto w-full">
        <h2
          className="text-3xl md:text-4xl font-bold text-white text-center mb-4"
          data-animate
        >
          Comment ça marche ?
        </h2>
        <p
          className="text-[#94a3b8] text-center mb-16 max-w-lg mx-auto"
          data-animate
          style={{ '--stagger': '80ms' } as React.CSSProperties}
        >
          En 3 étapes, tu passes de spectateur à roi du prono.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-10">
          {steps.map((step, i) => (
            <div
              key={step.number}
              className="relative text-center group"
              data-animate
              style={{ '--stagger': `${160 + i * 100}ms` } as React.CSSProperties}
            >
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-[16px] bg-[#ff9900]/10 border border-[#ff9900]/20 text-[#ff9900] mb-6 group-hover:bg-[#ff9900]/20 group-hover:shadow-[0_0_20px_rgba(255,153,0,0.15)] transition-all duration-300">
                {step.icon}
              </div>
              <div className="text-xs font-bold text-[#ff9900]/60 tracking-widest mb-2">{step.number}</div>
              <h3 className="text-xl font-bold text-white mb-3">{step.title}</h3>
              <p className="text-[#94a3b8] leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// =============================================
// SECTION 3 — FEATURES
// =============================================
function FeaturesSection() {
  const features = [
    {
      title: 'Classements en temps réel',
      description: 'Suis ton évolution et celle de tes potes à chaque journée. Qui prend la tête ?',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
        </svg>
      ),
    },
    {
      title: 'Chat entre joueurs',
      description: 'Chambre tes potes, réagis à leurs pronos, mentionne-les. Le vestiaire est chaud.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
    {
      title: '16 trophées à débloquer',
      description: "Nostradamus, Ballon d'Or, Roi de la journée... Collectionne-les tous.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
        </svg>
      ),
    },
    {
      title: 'Rappels automatiques',
      description: 'On te prévient avant chaque match pour ne jamais oublier un prono.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      ),
    },
    {
      title: 'Compétitions variées',
      description: "Ligue 1, Premier League, Champions League, Best of Week... Il y en a pour tous les goûts.",
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      title: 'Mobile et web',
      description: 'Joue depuis ton téléphone ou ton ordi. Tes pronos se synchronisent partout.',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
  ]

  return (
    <section
      id="features"
      data-chapter="Fonctionnalités"
      className="min-h-screen flex items-center px-4 py-20 md:py-0 bg-[#020617] md:snap-start"
    >
      <div className="max-w-5xl mx-auto w-full">
        <h2
          className="text-3xl md:text-4xl font-bold text-white text-center mb-4"
          data-animate
        >
          Tout pour vivre le foot à fond
        </h2>
        <p
          className="text-[#94a3b8] text-center mb-16 max-w-lg mx-auto"
          data-animate
          style={{ '--stagger': '80ms' } as React.CSSProperties}
        >
          PronoHub, c&apos;est bien plus qu&apos;un simple tableau de pronostics.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="p-6 rounded-[16px] bg-[#1e293b]/50 border border-white/[0.08] hover:border-[#ff9900]/30 hover:bg-[#1e293b]/80 hover:shadow-[0_0_20px_rgba(255,153,0,0.08)] transition-all duration-300"
              data-animate
              style={{ '--stagger': `${160 + i * 80}ms` } as React.CSSProperties}
            >
              <div className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-[#ff9900]/10 text-[#ff9900] mb-4">
                {f.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-[#94a3b8] text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// =============================================
// SECTION 4 — SOCIAL PROOF
// =============================================
function SocialProofSection() {
  const stats = [
    { value: '100+', label: 'Tournois créés' },
    { value: '500+', label: 'Joueurs actifs' },
    { value: '10 000+', label: 'Pronostics enregistrés' },
  ]

  return (
    <section
      id="proof"
      data-chapter="Communauté"
      className="min-h-screen flex items-center px-4 py-20 md:py-0 bg-[#0f1729] md:snap-start"
    >
      <div className="max-w-4xl mx-auto w-full text-center">
        <h2
          className="text-3xl md:text-4xl font-bold text-white mb-16"
          data-animate
        >
          Ils pronostiquent déjà sur PronoHub
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="space-y-2"
              data-animate
              style={{ '--stagger': `${100 + i * 100}ms` } as React.CSSProperties}
            >
              <div className="text-4xl md:text-5xl font-bold text-[#ff9900]">{stat.value}</div>
              <div className="text-[#94a3b8]">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// =============================================
// SECTION 5 — PRICING TEASER
// =============================================
function PricingTeaser() {
  return (
    <section
      id="pricing"
      data-chapter="Tarifs"
      className="min-h-screen flex items-center px-4 py-20 md:py-0 bg-[#020617] md:snap-start"
    >
      <div className="max-w-3xl mx-auto w-full text-center">
        <h2
          className="text-3xl md:text-4xl font-bold text-white mb-4"
          data-animate
        >
          Gratuit pour commencer
        </h2>
        <p
          className="text-[#94a3b8] mb-12 max-w-lg mx-auto"
          data-animate
          style={{ '--stagger': '80ms' } as React.CSSProperties}
        >
          Crée jusqu&apos;à 2 tournois gratuits avec 5 joueurs. Besoin de plus ? Nos offres s&apos;adaptent à ta bande de potes.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto mb-12">
          {/* Free */}
          <div
            className="p-6 rounded-[16px] bg-[#1e293b]/50 border border-white/[0.08]"
            data-animate
            style={{ '--stagger': '160ms' } as React.CSSProperties}
          >
            <div className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">Free-Kick</div>
            <div className="text-3xl font-bold text-white mb-4">0 &euro;</div>
            <ul className="space-y-3 text-sm text-[#94a3b8] text-left">
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> 2 tournois actifs</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> 5 joueurs max</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> Toutes les compétitions</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> Chat et trophées</li>
            </ul>
          </div>

          {/* Premium */}
          <div
            className="p-6 rounded-[16px] bg-[#ff9900]/[0.05] border border-[#ff9900]/30"
            data-animate
            style={{ '--stagger': '240ms' } as React.CSSProperties}
          >
            <div className="text-sm font-semibold text-[#ff9900] uppercase tracking-wider mb-2">Premium</div>
            <div className="text-3xl font-bold text-white mb-4">dès 4,99 &euro;</div>
            <ul className="space-y-3 text-sm text-[#94a3b8] text-left">
              <li className="flex items-center gap-2"><span className="text-[#ff9900]">&#10003;</span> Jusqu&apos;à 30 joueurs</li>
              <li className="flex items-center gap-2"><span className="text-[#ff9900]">&#10003;</span> Tournois illimités</li>
              <li className="flex items-center gap-2"><span className="text-[#ff9900]">&#10003;</span> Match bonus x2</li>
              <li className="flex items-center gap-2"><span className="text-[#ff9900]">&#10003;</span> Extensions joueurs et durée</li>
            </ul>
          </div>
        </div>

        <div data-animate style={{ '--stagger': '320ms' } as React.CSSProperties}>
          <Link
            href="/pricing"
            className="inline-block font-semibold text-sm text-[#ff9900] border border-[#ff9900]/30 rounded-[14px] px-6 py-3 hover:bg-[#ff9900]/10 transition-colors duration-300"
          >
            Voir tous les tarifs &rarr;
          </Link>
        </div>
      </div>
    </section>
  )
}

// =============================================
// SECTION 6 — CTA FINAL + FOOTER
// Combined as one snap unit so footer is reachable with snap-mandatory
// =============================================
function CTAFooter() {
  return (
    <div id="cta" data-chapter="Commencer" className="min-h-screen flex flex-col md:snap-start">
      {/* CTA content */}
      <div className="flex-1 flex items-center justify-center px-4 py-20 relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#ff9900]/[0.08] via-[#020617] to-[#020617]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#ff9900]/[0.04] rounded-full blur-[150px]" />

        <div className="relative z-10 max-w-2xl mx-auto text-center space-y-6">
          <h2
            className="text-3xl md:text-4xl font-bold text-white"
            data-animate
          >
            Prêt à défier tes potes ?
          </h2>
          <p
            className="text-[#94a3b8] text-lg"
            data-animate
            style={{ '--stagger': '100ms' } as React.CSSProperties}
          >
            Rejoins la communauté et montre-leur qui est le vrai roi du prono.
          </p>
          <div
            className="pt-4"
            data-animate
            style={{ '--stagger': '200ms' } as React.CSSProperties}
          >
            <Link
              href="/auth/signup"
              className="inline-block font-semibold text-base rounded-[14px] px-10 py-4 bg-[#ff9900] text-[#1a1a1a] shadow-[0_0_30px_rgba(255,153,0,0.4)] hover:bg-[#e68a00] hover:shadow-[0_0_40px_rgba(255,153,0,0.6)] hover:-translate-y-0.5 transition-all duration-300"
            >
              Commencer gratuitement
            </Link>
          </div>
          <p
            className="text-sm text-[#64748b]"
            data-animate
            style={{ '--stagger': '300ms' } as React.CSSProperties}
          >
            Pas de carte bancaire requise
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-4 py-6 border-t border-white/[0.08]">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image src="/images/logo.svg" alt="PronoHub" width={20} height={20} className="w-5 h-auto" />
              <span className="text-sm text-[#64748b]">PronoHub &copy; {new Date().getFullYear()}</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-6 text-sm text-[#64748b]">
              <Link href="/about" className="hover:text-[#ff9900] transition-colors">À propos</Link>
              <Link href="/pricing" className="hover:text-[#ff9900] transition-colors">Tarifs</Link>
              <Link href="/contact" className="hover:text-[#ff9900] transition-colors">Contact</Link>
              <Link href="/cgv" className="hover:text-[#ff9900] transition-colors">CGU</Link>
              <Link href="/privacy" className="hover:text-[#ff9900] transition-colors">Confidentialité</Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  )
}

// =============================================
// PAGE (SSR entry)
// =============================================
export default function LandingPreview() {
  return (
    <ClientShell>
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <SocialProofSection />
      <PricingTeaser />
      <CTAFooter />
    </ClientShell>
  )
}
