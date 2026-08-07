import Link from 'next/link'
import Image from 'next/image'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getTranslations, getLocale } from 'next-intl/server'
import { ClientShell } from './ClientShell'
import { AnimatedCounter } from './AnimatedCounter'
import { ShareButtons } from './ShareButtons'
import { getCompetitions } from '@/lib/seo/pronostics-content'
import type { Locale } from '@/i18n/routing'
import { getFeaturedPublicTournament } from '@/lib/public-tournament'
import './landing.css'

export async function generateMetadata() {
  const t = await getTranslations('Landing.meta')
  return {
    title: t('title'),
    description: t('description'),
    openGraph: {
      title: t('title'),
      description: t('ogDescription'),
      url: 'https://www.pronohub.club',
      siteName: 'PronoHub',
      type: 'website',
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'PronoHub' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: t('title'),
      description: t('ogDescription'),
      images: ['/opengraph-image'],
    },
    alternates: {
      canonical: 'https://www.pronohub.club',
    },
  }
}

// =============================================
// SECTION 1 — HERO
// =============================================
async function HeroSection() {
  const t = await getTranslations('Landing.hero')
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

      {/* ── Content: 2 columns on desktop ── */}
      <div className="relative z-[2] mx-auto flex min-h-[calc(100vh-56px)] max-w-7xl flex-col items-center px-6 pb-10 pt-20 sm:pt-24 md:flex-row md:items-center md:gap-8 lg:gap-12">

        {/* Left column: text + CTAs */}
        <div className="flex flex-col items-center text-center md:items-start md:text-left md:w-[40%] md:shrink-0">
          {/* H1 */}
          <h1
            className="max-w-3xl text-balance text-4xl font-semibold tracking-tight leading-[1.05] text-white sm:text-5xl lg:text-[56px]"
            data-animate
          >
            {t.rich('title', {
              br: () => <br className="hidden sm:block" />,
              k: (chunks) => <span className="text-[#ff9900]">{chunks}</span>,
              p: (chunks) => <span className="text-[#ff9900] text-5xl sm:text-6xl lg:text-[72px]">{chunks}</span>,
            })}
          </h1>

          {/* Subtitle */}
          <p
            className="mt-4 max-w-md text-pretty text-base leading-relaxed text-slate-300 sm:text-lg"
            data-animate
            style={{ '--stagger': '100ms' } as React.CSSProperties}
          >
            {t.rich('subtitle', { br: () => <br /> })}
          </p>

          {/* CTAs — stacked like reference */}
          <div
            className="mt-8 flex w-full max-w-md flex-col gap-3"
            data-animate
            style={{ '--stagger': '200ms' } as React.CSSProperties}
          >
            <Link
              href="/auth/signup"
              className="hero-cta-primary inline-flex h-14 items-center justify-center rounded-2xl bg-[#ff9900] px-8 text-base font-semibold text-black transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-[#ff9900] focus:ring-offset-0 active:scale-[0.98]"
            >
              {t('ctaPrimary')}
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex h-14 items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-8 text-base font-semibold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/60 active:scale-[0.98]"
            >
              {t('ctaSecondary')}
            </Link>
          </div>

          {/* Social proof — avatars + text */}
          <div
            className="mt-6 flex items-center gap-3"
            data-animate
            style={{ '--stagger': '300ms' } as React.CSSProperties}
          >
            <div className="flex -space-x-2">
              {[1,2,3,4].map((i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={`/images/avatars/avatar-${i}.png`}
                  alt=""
                  className="h-9 w-9 rounded-full border-2 border-[#0a0e1a] object-cover"
                />
              ))}
            </div>
            <p className="text-sm text-slate-300">
              {t.rich('social', { b: (chunks) => <span className="font-semibold text-white">{chunks}</span> })}
            </p>
          </div>
        </div>

        {/* Right column: mockups with carousel */}
        <div
          className="hero-mockups relative mt-10 w-full md:mt-0 md:w-[60%]"
          data-animate
          style={{ '--stagger': '400ms' } as React.CSSProperties}
        >
          {/* Desktop mockup */}
          <div className="mockup-desktop relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/frame-desktop.png" alt="" className="w-full h-auto relative z-[2]" />
            <div className="mockup-screen mockup-screen-desktop absolute overflow-hidden z-[1]">
              {[1,2,3,4,5].map((i) => (
                <Image
                  key={`desktop-${i}`}
                  src={`/images/desktop-${i}.png`}
                  alt={`PronoHub ${i}`}
                  width={1300}
                  height={770}
                  data-slide={i - 1}
                  className={`hero-slide absolute inset-0 w-full h-full object-cover object-top${i === 1 ? ' active' : ''}`}
                  priority={i === 1}
                  loading={i === 1 ? 'eager' : 'lazy'}
                  sizes="(max-width: 1024px) 55vw, 600px"
                />
              ))}
            </div>
          </div>

          {/* Mobile mockup */}
          <div className="mockup-mobile absolute z-[3]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/frame-mobile.png" alt="" className="w-full h-auto relative z-[2]" />
            <div className="mockup-screen mockup-screen-mobile absolute overflow-hidden z-[1]">
              {[1,2,3,4,5].map((i) => (
                <Image
                  key={`mobile-${i}`}
                  src={`/images/mobile-${i}.png`}
                  alt={`PronoHub ${i}`}
                  width={375}
                  height={812}
                  data-slide={i - 1}
                  className={`hero-slide absolute inset-0 w-full h-full object-cover object-top${i === 1 ? ' active' : ''}`}
                  priority={i === 1}
                  loading={i === 1 ? 'eager' : 'lazy'}
                  sizes="(max-width: 768px) 45vw, 150px"
                />
              ))}
            </div>
          </div>

          {/* Orange halo behind mockups */}
          <div className="hero-halo" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}

// =============================================
// SECTION 2 — COMMENT CA MARCHE (3 etapes)
// =============================================
async function HowItWorksSection() {
  const t = await getTranslations('Landing.how')
  const iconFilter = { filter: 'brightness(0) saturate(100%) invert(59%) sepia(95%) saturate(1936%) hue-rotate(360deg) brightness(101%) contrast(107%)' }
  const steps = [
    {
      n: '01',
      title: t('step1Title'),
      text: t('step1Text'),
      chip: t('step1Chip'),
      icon: <Image src="/images/icons/stadium-step.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-step-1.jpg',
    },
    {
      n: '02',
      title: t('step2Title'),
      text: t('step2Text'),
      chip: t('step2Chip'),
      icon: <Image src="/images/icons/friends-step.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-step-2.jpg',
    },
    {
      n: '03',
      title: t('step3Title'),
      text: t('step3Text'),
      chip: t('step3Chip'),
      icon: <Image src="/images/icons/cup-step.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
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
            {t('title')}
          </h2>
          <p
            className="mx-auto mt-2 max-w-xl text-sm text-slate-300 sm:text-base"
            data-animate
            style={{ '--stagger': '80ms' } as React.CSSProperties}
          >
            {t('subtitle')}
          </p>
        </div>

        <div className="mt-8 lg:mt-10">
          {/* Progress line + nodes (desktop) */}
          <div className="timeline-bar relative mx-auto mb-6 hidden h-4 lg:block" aria-hidden="true" data-animate>
            <div className="absolute left-[60px] right-[60px] top-1/2 h-px bg-white/[0.08]" />
            <div className="timeline-node timeline-node-1 absolute left-[calc(16.67%)] top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ff9900]/40 bg-[#ff9900]/25" />
            <div className="timeline-node timeline-node-2 absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ff9900]/40 bg-[#ff9900]/25" />
            <div className="timeline-node timeline-node-3 absolute left-[calc(83.33%)] top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#ff9900]/40 bg-[#ff9900]/25" />
          </div>

          <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
            {steps.map((step, i) => (
              <div
                key={step.n}
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
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#ff9900]/70">{t('step', { n: step.n })}</span>
                </div>

                <h3 className="relative mt-3.5 text-[17px] font-semibold text-white leading-snug">{step.title}</h3>
                <p className="relative mt-1.5 text-[13px] leading-relaxed text-slate-300">{step.text}</p>

                {step.chip && (
                  <div className="relative mt-3 inline-flex items-center rounded-full border border-[#ff9900]/15 bg-[#ff9900]/5 px-3 py-1 text-xs font-medium text-[#ff9900]/90">
                    {step.chip}
                  </div>
                )}
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
async function FeaturesSection() {
  const t = await getTranslations('Landing.features')
  const iconFilter = { filter: 'brightness(0) saturate(100%) invert(59%) sepia(95%) saturate(1936%) hue-rotate(360deg) brightness(101%) contrast(107%)' }
  const features = [
    {
      label: t('f1Label'),
      title: t('f1Title'),
      description: t('f1Desc'),
      icon: <Image src="/images/icons/podium.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-sect3-card1.jpg',
    },
    {
      label: t('f2Label'),
      title: t('f2Title'),
      description: t('f2Desc'),
      icon: <Image src="/images/icons/chat.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-sect3-card2.jpg',
    },
    {
      label: t('f3Label'),
      title: t('f3Title'),
      description: t('f3Desc'),
      icon: <Image src="/images/icons/trophy-section.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-sect3-card3.jpg',
    },
    {
      label: t('f4Label'),
      title: t('f4Title'),
      description: t('f4Desc'),
      icon: <Image src="/images/icons/rappel.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-sect3-card4.jpg',
    },
    {
      label: t('f5Label'),
      title: t('f5Title'),
      description: t('f5Desc'),
      icon: <Image src="/images/icons/compet.svg" alt="" width={22} height={22} className="w-[22px] h-[22px]" style={iconFilter} unoptimized aria-hidden />,
      bg: '/images/bg-sect3-card5.jpg',
    },
    {
      label: t('f6Label'),
      title: t('f6Title'),
      description: t('f6Desc'),
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
          {t('title')}
        </h2>
        <p
          className="text-slate-300 text-center mt-3 mb-12 sm:mb-16 max-w-lg mx-auto text-sm sm:text-base font-normal"
          data-animate
          style={{ '--stagger': '80ms' } as React.CSSProperties}
        >
          {t('subtitle')}
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
async function SocialProofSection() {
  const t = await getTranslations('Landing.proof')
  const stats = [
    { target: 100, suffix: '+', label: t('stat1') },
    { target: 500, suffix: '+', label: t('stat2') },
    { target: 10000, suffix: '+', label: t('stat3') },
  ]

  const testimonials = [
    {
      name: 'Zizou34',
      avatar: '/avatars/avatar5.png',
      quote: t('t1Quote'),
      tag: t('t1Tag'),
    },
    {
      name: 'Sandrinette',
      avatar: '/avatars/avatar12.png',
      quote: t('t2Quote'),
      tag: t('t2Tag'),
    },
    {
      name: 'Théo_File',
      avatar: '/avatars/avatar3.png',
      quote: t('t3Quote'),
      tag: t('t3Tag'),
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
          {t.rich('title', {
            logo: () => <Image src="/images/logo.svg" alt="" width={72} height={72} className="inline-block align-middle w-18 h-auto -mt-2 ml-2" unoptimized aria-hidden />,
          })}
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
        <p className="text-white/70 text-base mb-8" data-animate>{t('reviewsIntro')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-[18px]">
          {testimonials.map((tm, i) => (
            <article
              key={tm.name}
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
                  <Image src={tm.avatar} alt={tm.name} width={44} height={44} className="w-full h-full object-cover" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-white tracking-tight">{tm.name}</span>
                  <div className="flex gap-0.5 text-[#ff9900] text-sm leading-none drop-shadow-[0_6px_14px_rgba(255,153,0,0.15)]" aria-label="5/5" role="img">
                    {[...Array(5)].map((_, s) => (
                      <span key={`star-${s}`} aria-hidden="true">&#9733;</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Quote */}
              <p className="relative z-[1] text-white/[0.78] text-sm leading-relaxed mb-3.5">
                &ldquo;{tm.quote}&rdquo;
              </p>

              {/* Tag */}
              <div className="relative z-[1] inline-flex items-center gap-2 px-2.5 py-2 rounded-full border border-white/10 bg-black/20 text-white/70 text-xs">
                <span className="w-[7px] h-[7px] rounded-full bg-[#ff9900] shadow-[0_0_0_5px_rgba(255,153,0,0.10)]" />
                {tm.tag}
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
async function PricingTeaser() {
  const t = await getTranslations('Landing.pricing')
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
          {t('title')}
        </h2>
        <p
          className="text-[#cbd5e1] mb-12 max-w-lg mx-auto"
          data-animate
          style={{ '--stagger': '80ms' } as React.CSSProperties}
        >
          {t('subtitle')}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl mx-auto mb-12">
          {/* Free */}
          <div
            className="p-6 rounded-[16px] bg-[#1e293b]/50 border border-white/[0.08]"
            data-animate
            style={{ '--stagger': '160ms' } as React.CSSProperties}
          >
            <div className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wider mb-2">{t('freeName')}</div>
            <div className="text-3xl font-bold text-white mb-4">{t('freePrice')}</div>
            <ul className="space-y-3 text-sm text-[#cbd5e1] text-left">
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> {t('freeF1')}</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> {t('freeF2')}</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> {t('freeF3')}</li>
              <li className="flex items-center gap-2"><span className="text-green-400">&#10003;</span> {t('freeF4')}</li>
            </ul>
          </div>

          {/* Premium */}
          <div
            className="p-6 rounded-[16px] bg-[#ff9900]/[0.05] border border-[#ff9900]/30"
            data-animate
            style={{ '--stagger': '240ms' } as React.CSSProperties}
          >
            <div className="text-sm font-semibold text-[#ff9900] uppercase tracking-wider mb-2">{t('premiumName')}</div>
            <div className="text-3xl font-bold text-white mb-4">{t('premiumPrice')}</div>
            <ul className="space-y-3 text-sm text-[#cbd5e1] text-left">
              <li className="flex items-center gap-2"><span className="text-[#ff9900]">&#10003;</span> {t('premiumF1')}</li>
              <li className="flex items-center gap-2"><span className="text-[#ff9900]">&#10003;</span> {t('premiumF2')}</li>
              <li className="flex items-center gap-2"><span className="text-[#ff9900]">&#10003;</span> {t('premiumF3')}</li>
              <li className="flex items-center gap-2"><span className="text-[#ff9900]">&#10003;</span> {t('premiumF4')}</li>
            </ul>
          </div>
        </div>

        <div data-animate style={{ '--stagger': '320ms' } as React.CSSProperties}>
          <Link
            href="/pricing"
            className="inline-block font-semibold text-sm text-[#ff9900] border border-[#ff9900]/30 rounded-[14px] px-6 py-3 hover:bg-[#ff9900]/10 transition-colors duration-300"
          >
            {t('allPrices')}
          </Link>
        </div>
      </div>
    </section>
  )
}

// =============================================
// SECTION 6 — CTA FINAL + FOOTER
// =============================================
async function CTAFooter() {
  const t = await getTranslations('Landing.cta')
  const tf = await getTranslations('Landing.footer')
  const locale = (await getLocale()) as Locale
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
            {t('title')}
          </h2>
          <p
            className="text-[#cbd5e1] text-lg"
            data-animate
            style={{ '--stagger': '100ms' } as React.CSSProperties}
          >
            {t('subtitle')}
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
              {t('button')}
            </Link>
          </div>
          <p
            className="text-sm text-[#cbd5e1]"
            data-animate
            style={{ '--stagger': '300ms' } as React.CSSProperties}
          >
            {t('noCard')}
          </p>

          {/* Share buttons */}
          <div
            className="pt-10 flex flex-col items-center gap-4"
            data-animate
            style={{ '--stagger': '400ms' } as React.CSSProperties}
          >
            <p className="text-sm text-[#64748b]">{t('share')}</p>
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
              <Link href="/pronostics" className="hover:text-[#ff9900] transition-colors">{tf('pronostics')}</Link>
              <Link href="/guides" className="hover:text-[#ff9900] transition-colors">{tf('guides')}</Link>
              <Link href="/about" className="hover:text-[#ff9900] transition-colors">{tf('about')}</Link>
              <Link href="/pricing" className="hover:text-[#ff9900] transition-colors">{tf('pricing')}</Link>
              <Link href="/contact" className="hover:text-[#ff9900] transition-colors">{tf('contact')}</Link>
              <Link href="/cgv" className="hover:text-[#ff9900] transition-colors">{tf('cgu')}</Link>
              <Link href="/privacy" className="hover:text-[#ff9900] transition-colors">{tf('privacy')}</Link>
            </nav>
          </div>

          {/* Maillage interne SEO : pronostics par compétition */}
          <div className="mt-6 pt-5 border-t border-white/[0.06]">
            <p className="text-xs text-[#64748b] mb-2 text-center md:text-left">{tf('byCompetition')}</p>
            <nav className="flex flex-wrap justify-center md:justify-start gap-x-4 gap-y-1.5 text-xs text-[#64748b]">
              {getCompetitions(locale).map((c) => (
                <Link key={c.slug} href={`/pronostics/${c.slug}`} className="hover:text-[#ff9900] transition-colors">
                  {c.short}
                </Link>
              ))}
              <Link href="/pronostics" className="text-[#94a3b8] hover:text-[#ff9900] transition-colors">
                {tf('allCompetitions')}
              </Link>
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
export default async function Home() {
  // Sur l'app Android (Capacitor), pas besoin de la landing → rediriger vers le dashboard
  const headersList = await headers()
  const userAgent = headersList.get('user-agent') || ''
  if (/Android.*wv/.test(userAgent) || /; wv\)/.test(userAgent)) {
    redirect('/dashboard')
  }

  const featuredPublic = await getFeaturedPublicTournament()

  return (
    <ClientShell featured={featuredPublic}>
      <HeroSection />
      <HowItWorksSection />
      <FeaturesSection />
      <SocialProofSection />
      <PricingTeaser />
      <CTAFooter />
    </ClientShell>
  )
}
