/**
 * Contenu SEO des pages /pronostics/[slug] (une par compétition) + hub /pronostics.
 * Copie rédigée à la main (FR) : on ne vise PAS « pronostic ligue 1 » (écrasé par les sites de
 * paris) mais l'intention différenciante de PronoHub : pronos ENTRE AMIS, GRATUIT, SANS ARGENT.
 */

export interface CompetitionSeo {
  slug: string          // segment URL FR
  competitionId: number // id table competitions (pour le logo)
  dbName: string        // nom exact en base (fallback)
  name: string          // nom affiché avec article ("la Ligue 1")
  short: string         // nom court
  title: string         // <title>
  h1: string
  description: string   // meta description (~150-160c)
  intro: string         // paragraphe d'intro unique
}

export const COMPETITIONS_SEO: CompetitionSeo[] = [
  {
    slug: 'ligue-1',
    competitionId: 2015,
    dbName: 'Ligue 1',
    name: 'la Ligue 1',
    short: 'Ligue 1',
    title: 'Pronostics Ligue 1 entre amis — tournoi gratuit | PronoHub',
    h1: 'Pronostics Ligue 1 entre amis',
    description: 'Crée un tournoi de pronostics Ligue 1 entre amis, 100% gratuit et sans argent. Défie tes potes journée après journée, grimpe au classement et rafle les trophées.',
    intro: "Le championnat de France est le terrain de jeu idéal pour un tournoi de pronos entre amis : 34 journées, des chocs OM-PSG, et chaque week-end une occasion de prouver que tu lis mieux le foot que tes potes. Sur PronoHub, tu crées ton tournoi Ligue 1 en une minute, tu invites ta bande, et c'est parti — gratuitement.",
  },
  {
    slug: 'ligue-des-champions',
    competitionId: 2001,
    dbName: 'UEFA Champions League',
    name: 'la Ligue des Champions',
    short: 'Champions League',
    title: 'Pronostics Ligue des Champions entre amis — gratuit | PronoHub',
    h1: 'Pronostics Ligue des Champions entre amis',
    description: 'Lance un tournoi de pronostics Ligue des Champions entre amis, gratuit et sans argent. Des phases de poules à la finale, marque des points et vise le sommet du classement.',
    intro: "Les grandes soirées européennes se vivent encore mieux à plusieurs. Crée un tournoi de pronostics Ligue des Champions et transforme chaque mardi et mercredi soir en défi entre potes : qui aura vu le hold-up, le carton, la qualif' improbable ? Sur PronoHub, c'est gratuit du premier match de poule jusqu'à la finale.",
  },
  {
    slug: 'coupe-du-monde',
    competitionId: 2000,
    dbName: 'FIFA World Cup',
    name: 'la Coupe du Monde',
    short: 'Coupe du Monde',
    title: 'Pronostics Coupe du Monde 2026 entre amis — gratuit | PronoHub',
    h1: 'Pronostics Coupe du Monde entre amis',
    description: "Organise ton tournoi de pronostics Coupe du Monde entre amis ou collègues, gratuitement. De la phase de groupes à la finale, le rendez-vous foot d'une génération.",
    intro: "Un Mondial, ça ne se regarde pas seul dans son coin. Monte le tournoi de pronostics de la Coupe du Monde avec tes amis, ta famille ou tout le bureau : phase de groupes, huitièmes, quarts… chaque match compte pour le classement. Création gratuite, invitations en un lien, et l'ambiance d'une compétition qui dure tout l'été.",
  },
  {
    slug: 'premier-league',
    competitionId: 2021,
    dbName: 'Premier League',
    name: 'la Premier League',
    short: 'Premier League',
    title: 'Pronostics Premier League entre amis — tournoi gratuit | PronoHub',
    h1: 'Pronostics Premier League entre amis',
    description: 'Crée un tournoi de pronostics Premier League entre amis, gratuit et sans argent. 38 journées de foot anglais pour départager ta bande.',
    intro: "Le championnat le plus imprévisible du monde mérite un vrai tournoi entre potes. Big Six, outsiders qui piquent des points, remontadas du samedi 16h : sur PronoHub, tu crées ton tournoi de pronostics Premier League gratuitement et tu vois enfin qui maîtrise vraiment le foot anglais.",
  },
  {
    slug: 'liga',
    competitionId: 2014,
    dbName: 'Primera Division',
    name: 'la Liga',
    short: 'Liga',
    title: 'Pronostics Liga entre amis — tournoi gratuit | PronoHub',
    h1: 'Pronostics Liga entre amis',
    description: 'Lance un tournoi de pronostics Liga entre amis, 100% gratuit. Real, Barça, Atlético… pronostique le championnat espagnol et défie tes potes.',
    intro: "Clásicos, derbis madrilènes et surprises andalouses : la Liga a tout pour un tournoi de pronos animé. Crée ta compétition de pronostics du championnat espagnol sur PronoHub, invite tes amis et suis le classement se dessiner journée après journée — gratuitement.",
  },
  {
    slug: 'serie-a',
    competitionId: 2019,
    dbName: 'Serie A',
    name: 'la Serie A',
    short: 'Serie A',
    title: 'Pronostics Serie A entre amis — tournoi gratuit | PronoHub',
    h1: 'Pronostics Serie A entre amis',
    description: 'Crée un tournoi de pronostics Serie A entre amis, gratuit et sans argent. Le calcio comme terrain de jeu pour départager ta bande.',
    intro: "Tactique, buts inattendus et défenses de fer : le calcio récompense ceux qui regardent vraiment les matchs. Monte ton tournoi de pronostics Serie A entre amis sur PronoHub, gratuitement, et prouve que tu connais l'Italie du foot mieux que tes potes.",
  },
  {
    slug: 'bundesliga',
    competitionId: 2002,
    dbName: 'Bundesliga',
    name: 'la Bundesliga',
    short: 'Bundesliga',
    title: 'Pronostics Bundesliga entre amis — tournoi gratuit | PronoHub',
    h1: 'Pronostics Bundesliga entre amis',
    description: 'Organise un tournoi de pronostics Bundesliga entre amis, gratuit. Buts à la pelle et championnat allemand pour défier ta bande chaque week-end.',
    intro: "Le championnat des stades pleins et des matchs à rallonge de buts est parfait pour pronostiquer. Crée ton tournoi de pronostics Bundesliga avec tes amis sur PronoHub : création gratuite, invitations en un clic, et un classement qui s'emballe dès la première journée.",
  },
  {
    slug: 'liga-portugal',
    competitionId: 2017,
    dbName: 'Primeira Liga',
    name: 'la Liga Portugal',
    short: 'Primeira Liga',
    title: 'Pronostics Liga Portugal entre amis — gratuit | PronoHub',
    h1: 'Pronostics Liga Portugal entre amis',
    description: 'Crée un tournoi de pronostics Liga Portugal (Primeira Liga) entre amis, gratuit et sans argent. Benfica, Porto, Sporting… à toi de jouer.',
    intro: "Benfica, Porto, Sporting et les pépites de demain : la Liga Portugal réserve son lot de surprises. Lance ton tournoi de pronostics du championnat portugais entre amis sur PronoHub, gratuitement, et suis qui domine la course au titre… version pronos.",
  },
  {
    slug: 'eredivisie',
    competitionId: 2003,
    dbName: 'Eredivisie',
    name: "l'Eredivisie",
    short: 'Eredivisie',
    title: 'Pronostics Eredivisie entre amis — tournoi gratuit | PronoHub',
    h1: 'Pronostics Eredivisie entre amis',
    description: "Lance un tournoi de pronostics Eredivisie entre amis, gratuit. Le foot néerlandais spectaculaire pour départager ta bande.",
    intro: "Ajax, PSV, Feyenoord et un football offensif qui envoie du jeu : l'Eredivisie est un régal à pronostiquer. Crée ton tournoi de pronostics du championnat néerlandais entre amis sur PronoHub, gratuitement, et vois qui anticipe le mieux les cartons du week-end.",
  },
  {
    slug: 'championnat-bresilien',
    competitionId: 2013,
    dbName: 'Campeonato Brasileiro Série A',
    name: 'le Championnat brésilien',
    short: 'Brasileirão',
    title: 'Pronostics Championnat brésilien entre amis — gratuit | PronoHub',
    h1: 'Pronostics Championnat brésilien entre amis',
    description: 'Crée un tournoi de pronostics du Brasileirão entre amis, gratuit et sans argent. Le foot brésilien pour défier ta bande toute la saison.',
    intro: "Flamengo, Palmeiras, Corinthians : le Brasileirão, c'est de la passion à l'état pur et des résultats jamais écrits d'avance. Monte ton tournoi de pronostics du championnat brésilien entre amis sur PronoHub, gratuitement, et confronte ton flair à celui de tes potes.",
  },
]

export function getCompetitionSeo(slug: string): CompetitionSeo | undefined {
  return COMPETITIONS_SEO.find((c) => c.slug === slug)
}
