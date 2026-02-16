import Link from 'next/link'
import Image from 'next/image'
import { ClientShell } from './ClientShell'
import { AnimatedCounter } from './AnimatedCounter'
import { ShareButtons } from './ShareButtons'
import './landing.css'

export const metadata = {
  title: 'Pronostics Football entre Amis | Tournoi Gratuit - PronoHub',
  description: 'Crée ton tournoi de pronostics football gratuit et défie tes amis sur la Ligue 1, Champions League et Premier League. Classements en direct, trophées et chat. Inscription en 30 secondes, sans carte bancaire.',
  openGraph: {
    title: 'Pronostics Football entre Amis | Tournoi Gratuit - PronoHub',
    description: 'Crée ton tournoi de pronostics football gratuit et défie tes amis. Classements en direct, trophées et chat.',
    url: 'https://www.pronohub.club',
    siteName: 'PronoHub',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'PronoHub - Pronostics Football entre Amis' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pronostics Football entre Amis | Tournoi Gratuit - PronoHub',
    description: 'Crée ton tournoi de pronostics football gratuit et défie tes amis.',
    images: ['/opengraph-image'],
  },
  alternates: {
    canonical: 'https://www.pronohub.club',
  },
}

// =============================================
// SECTION 1 — HERO
// =============================================
function HeroSection() {
  return (
    <section id="hero" data-chapter="Hero" className="relative overflow-hidden md:snap-start">
      {/* ── Parallax background image ── */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/bg-landing.jpg"
          alt=""
          className="hero-parallax-bg"
        />
      </div>

      {/* ── Overlay gradient (over image, under content) ── */}
      <div className="pointer-events-none absolute inset-0 z-[1]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(15,23,41,0.35)_0%,rgba(2,6,23,0.7)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_78%,rgba(255,153,0,0.14)_0%,rgba(255,153,0,0.00)_45%)]" />
      </div>

      {/* ── Content ── */}
      <div className="relative z-[2] mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl flex-col items-center px-6 pb-10 pt-20 text-center sm:pt-24">

        {/* H1 */}
        <h1
          className="max-w-3xl text-balance text-4xl font-semibold tracking-tight leading-[1.05] text-white sm:text-5xl lg:text-[56px]"
          data-animate
        >
          Pronostics foot entre potes :
          <br className="hidden sm:block" />
          {' '}deviens le <span className="text-[#ff9900]">roi du prono</span>.
        </h1>

        {/* Subtitle */}
        <p
          className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-slate-300 sm:text-lg"
          data-animate
          style={{ '--stagger': '100ms' } as React.CSSProperties}
        >
          Crée un tournoi, invite tes potes et grimpe au classement en temps réel.
        </p>

        {/* CTAs */}
        <div
          className="mt-6 flex w-full max-w-xl flex-col gap-3 sm:flex-row sm:justify-center"
          data-animate
          style={{ '--stagger': '200ms' } as React.CSSProperties}
        >
          <Link
            href="/auth/signup"
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#ff9900] px-6 text-sm font-semibold text-black shadow-[0_10px_30px_rgba(255,153,0,0.18)] transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#ff9900] focus:ring-offset-0 active:scale-[0.98]"
          >
            Créer mon tournoi
          </Link>
          <Link
            href="/auth/login"
            className="inline-flex h-12 items-center justify-center rounded-2xl border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60 active:scale-[0.98]"
          >
            Se connecter
          </Link>
        </div>

        {/* Trust line */}
        <p
          className="mt-3 flex items-center gap-2 text-xs text-slate-400"
          data-animate
          style={{ '--stagger': '300ms' } as React.CSSProperties}
        >
          <span>Gratuit</span>
          <span className="text-slate-600">&bull;</span>
          <span>Sans pub</span>
          <span className="text-slate-600">&bull;</span>
          <span>30 secondes</span>
        </p>

        {/* ── Hero image ── */}
        <div
          className="relative mt-8 w-full max-w-4xl"
          data-animate
          style={{ '--stagger': '400ms' } as React.CSSProperties}
        >
          <Image src="/images/hero-img.png" alt="PronoHub - Aperçu de l'application" width={1200} height={800} className="mx-auto w-full h-auto" priority sizes="(max-width: 1024px) 100vw, 896px" />
        </div>
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
      n: '01',
      title: 'Crée ton tournoi',
      text: 'Choisis ta compétition et configure tes règles en quelques clics.',
      chip: "Champion's League, Ligue 1,...",
      icon: <Image src="/images/icons/stadium-step.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={{ filter: 'brightness(0) saturate(100%) invert(59%) sepia(95%) saturate(1936%) hue-rotate(360deg) brightness(101%) contrast(107%)' }} unoptimized aria-hidden />,
      bg: '/images/bg-step-1.jpg',
    },
    {
      n: '02',
      title: 'Invite tes potes',
      text: 'Partage le code et constitue ton groupe. Plus on est de fous, plus on rit.',
      chip: 'Trophées, tchat, bonus, stats',
      icon: <Image src="/images/icons/friends-step.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={{ filter: 'brightness(0) saturate(100%) invert(59%) sepia(95%) saturate(1936%) hue-rotate(360deg) brightness(101%) contrast(107%)' }} unoptimized aria-hidden />,
      bg: '/images/bg-step-2.jpg',
    },
    {
      n: '03',
      title: 'Pronostique et grimpe',
      text: 'Décroche des trophées et deviens le roi du classement.',
      chip: '+3 pts score exact \u2022 +1 pt bon résultat',
      icon: <Image src="/images/icons/cup-step.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={{ filter: 'brightness(0) saturate(100%) invert(59%) sepia(95%) saturate(1936%) hue-rotate(360deg) brightness(101%) contrast(107%)' }} unoptimized aria-hidden />,
      bg: '/images/bg-step-3.jpg',
    },
  ]

  return (
    <section
      id="how"
      data-chapter="Comment ça marche"
      aria-labelledby="how-title"
      className="relative py-20 scroll-mt-24 md:snap-start"
    >
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <h2
            id="how-title"
            className="text-2xl font-semibold tracking-tight text-white sm:text-3xl"
            data-animate
          >
            Comment jouer ?
          </h2>
          <p
            className="mx-auto mt-2 max-w-xl text-sm text-slate-300 sm:text-base"
            data-animate
            style={{ '--stagger': '80ms' } as React.CSSProperties}
          >
            En 3 étapes, tu passes de remplaçant à ballon d'or.
          </p>
        </div>

        <div className="relative mt-8 pl-8 lg:mt-10 lg:pl-0">
          {/* Mobile vertical timeline line */}
          <div className="absolute left-[11px] top-4 bottom-4 w-px bg-white/[0.08] lg:hidden" aria-hidden="true" />

          {/* Desktop horizontal progress line + nodes */}
          <div className="timeline-bar relative mx-auto mb-6 hidden h-4 lg:block" aria-hidden="true" data-animate>
            <div className="absolute left-[60px] right-[60px] top-1/2 h-px bg-white/[0.08]" />
            <div className="timeline-node timeline-node-1 absolute left-[calc(16.67%)] top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ff9900]/40 bg-[#ff9900]/25" />
            <div className="timeline-node timeline-node-2 absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ff9900]/40 bg-[#ff9900]/25" />
            <div className="timeline-node timeline-node-3 absolute left-[calc(83.33%)] top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ff9900]/40 bg-[#ff9900]/25" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            {steps.map((step, i) => (
              <div key={step.n} className="relative">
                {/* Mobile timeline node */}
                <div className="absolute top-6 h-2.5 w-2.5 -translate-x-1/2 rounded-full border border-[#ff9900]/40 bg-[#ff9900]/25 lg:hidden" style={{ left: '-21px' }} aria-hidden="true" />
                <div
                  className={`step-card step-card-${i + 1} group relative overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0f172a]/80 p-5 text-left shadow-[0_8px_40px_rgba(0,0,0,0.4)] transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_12px_48px_rgba(255,153,0,0.06)]`}
                  data-animate
                  style={{ '--stagger': `${160 + i * 100}ms` } as React.CSSProperties}
                >
                {step.bg && (
                  <>
                    <Image src={step.bg} alt="" fill sizes="(max-width: 1024px) 100vw, 33vw" className="object-cover opacity-20 transition duration-300 group-hover:opacity-30 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/80 via-[#0f172a]/30 to-transparent" />
                  </>
                )}
                <div className="relative flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#ff9900]/25 bg-[#ff9900]/10 text-[#ff9900] transition duration-300 group-hover:bg-[#ff9900]/20 group-hover:shadow-[0_0_20px_rgba(255,153,0,0.2)]">
                    {step.icon}
                  </div>
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#ff9900]/70">Étape {step.n}</span>
                </div>

                <h3 className="relative mt-3.5 text-[17px] font-semibold text-white leading-snug">{step.title}</h3>
                <p className="relative mt-1.5 text-[13px] leading-relaxed text-slate-300">{step.text}</p>

                {step.chip && (
                  <div className="relative mt-3 inline-flex items-center rounded-full border border-[#ff9900]/15 bg-[#ff9900]/5 px-3 py-1 text-xs font-medium text-[#ff9900]/90">
                    {step.chip}
                  </div>
                )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// =============================================
// SECTION 3 — FEATURES
// =============================================
function FeaturesSection() {
  const iconFilter = { filter: 'brightness(0) saturate(100%) invert(59%) sepia(95%) saturate(1936%) hue-rotate(360deg) brightness(101%) contrast(107%)' }
  const features = [
    {
      label: 'Toujours leader ?',
      title: 'Classements en temps réel',
      description: 'Suis ton évolution et celle de tes potes à chaque journée. Qui prend la tête ?',
      icon: <Image src="/images/icons/podium.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-sect3-card1.jpg',
    },
    {
      label: 'Déploie ta banderole',
      title: 'Chat entre joueurs',
      description: 'Chambre tes potes, réagis à leurs pronos, mentionne-les. Le vestiaire est chaud.',
      icon: <Image src="/images/icons/chat.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-sect3-card2.jpg',
    },
    {
      label: 'Palmarès',
      title: '16 trophées à débloquer',
      description: "Nostradamus, Ballon d'Or, Roi de la journée... Collectionne-les tous.",
      icon: <Image src="/images/icons/trophy-section.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-sect3-card3.jpg',
    },
    {
      label: 'Match retardé ?',
      title: 'Rappels automatiques',
      description: 'On te prévient avant chaque match pour ne jamais oublier un prono.',
      icon: <Image src="/images/icons/rappel.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-sect3-card4.jpg',
    },
    {
      label: 'Pas de répit',
      title: 'Compétitions variées',
      description: "Ligue 1, Premier League, Champions League, Best of Week... Il y en a pour tous les goûts.",
      icon: <Image src="/images/icons/compet.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-sect3-card5.jpg',
    },
    {
      label: "Pas d'excuses",
      title: 'Mobile et web',
      description: 'Joue depuis ton téléphone ou ton ordi. Tes pronos se synchronisent partout.',
      icon: <Image src="/images/icons/mobile.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-sect3-card6.jpg',
    },
  ]

  return (
    <section
      id="features"
      data-chapter="Les plus"
      className="relative min-h-screen flex items-center px-5 py-20 md:py-0 md:snap-start overflow-hidden"
    >
      {/* ── Section background ── */}
      <div className="absolute inset-0" aria-hidden="true">
        <Image src="/images/bg-section-3.jpg" alt="" fill sizes="100vw" className="object-cover opacity-50" />
      </div>

      <div className="relative z-[2] max-w-5xl mx-auto w-full">
        <h2
          className="text-2xl sm:text-3xl md:text-4xl font-semibold tracking-[-0.02em] leading-[1.1] text-white text-center"
          data-animate
        >
          Tout pour vivre le foot à fond
        </h2>
        <p
          className="text-slate-300 text-center mt-3 mb-12 sm:mb-16 max-w-lg mx-auto text-sm sm:text-base font-normal"
          data-animate
          style={{ '--stagger': '80ms' } as React.CSSProperties}
        >
          PronoHub, c&apos;est bien plus qu&apos;un simple tableau de pronostics.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((f, i) => (
            <div
              key={f.title}
              className="group relative overflow-hidden rounded-2xl border border-white/[0.12] bg-[#0f172a]/80 p-5 text-left shadow-[0_8px_40px_rgba(0,0,0,0.4)] transition duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-[0_12px_48px_rgba(255,153,0,0.06)]"
              data-animate
              style={{ '--stagger': `${160 + i * 80}ms` } as React.CSSProperties}
            >
              {f.bg && (
                <>
                  <Image src={f.bg} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover opacity-20 transition duration-300 group-hover:opacity-30 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a]/80 via-[#0f172a]/30 to-transparent" />
                </>
              )}

              <div className="relative flex items-center gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#ff9900]/25 bg-[#ff9900]/10 text-[#ff9900] transition duration-300 group-hover:bg-[#ff9900]/20 group-hover:shadow-[0_0_20px_rgba(255,153,0,0.2)]">
                  {f.icon}
                </div>
                <span className="text-sm font-bold tracking-[0.08em] uppercase text-[#ff9900]">{f.label}</span>
              </div>

              <h3 className="relative mt-3.5 text-lg font-semibold tracking-[-0.02em] text-white leading-snug">{f.title}</h3>
              <p className="relative mt-1.5 text-sm font-normal leading-[1.6] text-slate-300">{f.description}</p>
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
    { target: 100, suffix: '+', label: 'Tournois créés' },
    { target: 500, suffix: '+', label: 'Joueurs actifs' },
    { target: 10000, suffix: '+', label: 'Pronostics enregistrés' },
  ]

  const testimonials = [
    {
      name: 'Zizou34',
      avatar: '/avatars/avatar5.png',
      quote: "On a lancé un tournoi Ligue 1 en 2 minutes. Le classement en temps réel met une ambiance de fou.",
      tag: 'Tournoi entre potes',
    },
    {
      name: 'Sandrinette',
      avatar: '/avatars/avatar12.png',
      quote: "Le chat pendant les matchs est incroyable. Mentions, réactions… on se chambre non-stop.",
      tag: 'Chat & réactions',
    },
    {
      name: 'Théo_File',
      avatar: '/avatars/avatar3.png',
      quote: "Les trophées à débloquer rendent ça addictif. Et les rappels avant match évitent d'oublier.",
      tag: 'Trophées & rappels',
    },
  ]

  return (
    <section
      id="proof"
      data-chapter="Communauté"
      className="min-h-screen flex items-center px-4 py-20 md:py-0 bg-[#0f1729] md:snap-start"
    >
      <div className="max-w-5xl mx-auto w-full text-center">
        <h2
          className="text-3xl md:text-4xl font-bold text-white mb-16"
          data-animate
        >
          Ils s&apos;affrontent déjà sur <Image src="/images/logo.svg" alt="" width={72} height={72} className="inline-block align-middle w-18 h-auto -mt-2 ml-2" unoptimized aria-hidden /> PronoHub
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mb-16">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className="space-y-2"
              data-animate
              style={{ '--stagger': `${100 + i * 100}ms` } as React.CSSProperties}
            >
              <div className="text-4xl md:text-5xl font-bold text-[#ff9900]">
                <AnimatedCounter target={stat.target} suffix={stat.suffix} />
              </div>
              <div className="text-[#cbd5e1]">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Testimonials */}
        <p className="text-white/70 text-base mb-8" data-animate>3 avis récents de joueurs.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[18px]">
          {testimonials.map((t, i) => (
            <article
              key={t.name}
              className="testimonial-card relative rounded-[18px] border border-white/10 p-[18px] pb-4 text-left backdrop-blur-lg shadow-[0_25px_70px_rgba(0,0,0,0.45)] hover:-translate-y-1 hover:border-[#ff9900]/30 hover:shadow-[0_35px_90px_rgba(0,0,0,0.55)] transition-all duration-200"
              style={{
                background: 'linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03)), rgba(15,27,47,0.55)',
                '--stagger': `${400 + i * 150}ms`,
              } as React.CSSProperties}
              data-animate
            >
              {/* Orange glow overlay */}
              <div className="absolute inset-0 rounded-[18px] pointer-events-none opacity-90" style={{ background: 'radial-gradient(500px 200px at 20% 0%, rgba(255,153,0,0.12), transparent 55%)' }} />

              {/* Head: avatar + name + stars */}
              <div className="relative z-[1] flex items-center gap-3 mb-3.5">
                <div className="w-11 h-11 rounded-full overflow-hidden border border-[#ff9900]/35 shadow-[0_0_0_6px_rgba(255,153,0,0.06)] flex-shrink-0">
                  <Image src={t.avatar} alt={t.name} width={44} height={44} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-white tracking-tight">{t.name}</span>
                  <div className="flex gap-0.5 text-[#ff9900] text-sm leading-none drop-shadow-[0_6px_14px_rgba(255,153,0,0.15)]" aria-label="5 étoiles sur 5" role="img">
                    {[...Array(5)].map((_, s) => (
                      <span key={`star-${s}`} aria-hidden="true">&#9733;</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quote */}
              <p className="relative z-[1] text-white/[0.78] text-sm leading-relaxed mb-3.5">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Tag */}
              <div className="relative z-[1] inline-flex items-center gap-2 px-2.5 py-2 rounded-full border border-white/10 bg-black/20 text-white/70 text-xs">
                <span className="w-[7px] h-[7px] rounded-full bg-[#ff9900] shadow-[0_0_0_5px_rgba(255,153,0,0.10)]" />
                {t.tag}
              </div>
            </article>
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
      data-chapter="C'est gratuit"
      className="min-h-screen flex items-center px-5 py-20 md:py-0 bg-[#020617] md:snap-start"
    >
      <div className="max-w-3xl mx-auto w-full text-center">
        <h2
          className="text-3xl md:text-4xl font-bold text-white mb-4"
          data-animate
        >
          Gratuit pour commencer
        </h2>
        <p
          className="text-[#cbd5e1] mb-12 max-w-lg mx-auto"
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
            <ul className="space-y-3 text-sm text-[#cbd5e1] text-left">
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
            <ul className="space-y-3 text-sm text-[#cbd5e1] text-left">
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
            className="text-[#cbd5e1] text-lg"
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
              className="inline-block font-semibold text-base rounded-[14px] px-10 py-4 bg-[#ff9900] text-[#1a1a1a] shadow-[0_0_30px_rgba(255,153,0,0.4)] hover:bg-[#e68a00] hover:shadow-[0_0_40px_rgba(255,153,0,0.6)] hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] active:shadow-none transition-all duration-300"
            >
              Lancer mon tournoi gratuit
            </Link>
          </div>
          <p
            className="text-sm text-[#cbd5e1]"
            data-animate
            style={{ '--stagger': '300ms' } as React.CSSProperties}
          >
            Pas de carte bancaire requise
          </p>

          {/* Share buttons */}
          <div
            className="pt-10 flex flex-col items-center gap-4"
            data-animate
            style={{ '--stagger': '400ms' } as React.CSSProperties}
          >
            <p className="text-sm text-[#64748b]">Partage PronoHub avec tes potes</p>
            <ShareButtons />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-4 py-6 border-t border-white/[0.08]">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image src="/images/logo.svg" alt="PronoHub" width={20} height={20} className="w-5 h-auto" unoptimized />
              <span className="text-sm text-[#94a3b8]">PronoHub &copy; {new Date().getFullYear()}</span>
            </div>
            <nav className="flex flex-wrap justify-center gap-6 text-sm text-[#94a3b8]">
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
export default function Home() {
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
