/**
 * Contenu SEO des pages /pronostics/[slug] (une par compétition) + hub /pronostics.
 * Copie rédigée à la main (FR) : on ne vise PAS « pronostic ligue 1 » (écrasé par les sites de
 * paris) mais l'intention différenciante de PronoHub : pronos ENTRE AMIS, GRATUIT, SANS ARGENT.
 *
 * Bilingue FR/EN : `COMPETITIONS_SEO` est un Record indexé par locale. Les champs de DONNÉES
 * (`slug`, `competitionId`, `dbName`) sont IDENTIQUES entre les deux langues — on garde les mêmes
 * slugs pour ne pas casser le routing / le sitemap / les liens `related`. Le contenu EN est rédigé
 * pour l'intention de recherche anglophone (football prediction game with friends, free, no money).
 */

export interface CompetitionSeo {
  slug: string          // segment URL FR (identique EN)
  competitionId: number // id table competitions (pour le logo)
  dbName: string        // nom exact en base (fallback)
  name: string          // nom affiché avec article ("la Ligue 1")
  short: string         // nom court
  title: string         // <title>
  h1: string
  description: string   // meta description (~150-160c)
  intro: string         // paragraphe d'intro unique
}

const FR: CompetitionSeo[] = [
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

const EN: CompetitionSeo[] = [
  {
    slug: 'ligue-1',
    competitionId: 2015,
    dbName: 'Ligue 1',
    name: 'Ligue 1',
    short: 'Ligue 1',
    title: 'Ligue 1 prediction game with friends — free | PronoHub',
    h1: 'Ligue 1 predictions with friends',
    description: 'Start a free Ligue 1 prediction game with your friends — no money, no betting. Take on your mates matchday after matchday, climb the leaderboard and grab the trophies.',
    intro: "France's top flight is the perfect playground for a prediction league with your mates: 34 matchdays, PSG-Marseille clashes, and a weekly chance to prove you read the game better than your friends. On PronoHub you set up your Ligue 1 tournament in a minute, invite your crew, and you're off — completely free.",
  },
  {
    slug: 'ligue-des-champions',
    competitionId: 2001,
    dbName: 'UEFA Champions League',
    name: 'the Champions League',
    short: 'Champions League',
    title: 'Champions League prediction game with friends — free | PronoHub',
    h1: 'Champions League predictions with friends',
    description: 'Launch a free Champions League prediction game with your friends — no money involved. From the group stage to the final, rack up points and aim for the top of the leaderboard.',
    intro: "Those big European nights are even better shared. Create a Champions League prediction tournament and turn every Tuesday and Wednesday into a duel with your mates: who called the smash-and-grab, the thrashing, the unlikely qualification? On PronoHub it's free from the first group game all the way to the final.",
  },
  {
    slug: 'coupe-du-monde',
    competitionId: 2000,
    dbName: 'FIFA World Cup',
    name: 'the World Cup',
    short: 'World Cup',
    title: 'World Cup 2026 prediction game with friends — free | PronoHub',
    h1: 'World Cup predictions with friends',
    description: 'Run a free World Cup prediction pool with your friends or colleagues — no betting, no money. From the group stage to the final, the football event of a generation.',
    intro: "A World Cup isn't meant to be watched alone. Set up a World Cup prediction pool with your friends, your family or the whole office: group stage, round of 16, quarters… every match counts towards the leaderboard. Free to create, invites in a single link, and the buzz of a tournament that runs all summer.",
  },
  {
    slug: 'premier-league',
    competitionId: 2021,
    dbName: 'Premier League',
    name: 'the Premier League',
    short: 'Premier League',
    title: 'Premier League prediction game with friends — free | PronoHub',
    h1: 'Premier League predictions with friends',
    description: 'Start a free Premier League prediction game with your friends — no money, no betting. 38 matchdays of English football to settle the debate with your crew.',
    intro: "The most unpredictable league in the world deserves a proper contest between mates. Big Six wobbles, underdogs nicking points, last-gasp Saturday winners: on PronoHub you create your Premier League prediction game for free and finally find out who really knows English football.",
  },
  {
    slug: 'liga',
    competitionId: 2014,
    dbName: 'Primera Division',
    name: 'La Liga',
    short: 'Liga',
    title: 'La Liga prediction game with friends — free | PronoHub',
    h1: 'La Liga predictions with friends',
    description: 'Launch a free La Liga prediction game with your friends — no money involved. Real, Barça, Atlético… predict the Spanish league and take on your mates.',
    intro: "Clásicos, Madrid derbies and Andalusian surprises: La Liga has everything for a lively prediction league. Create your Spanish-league prediction game on PronoHub, invite your friends and watch the leaderboard take shape matchday after matchday — for free.",
  },
  {
    slug: 'serie-a',
    competitionId: 2019,
    dbName: 'Serie A',
    name: 'Serie A',
    short: 'Serie A',
    title: 'Serie A prediction game with friends — free | PronoHub',
    h1: 'Serie A predictions with friends',
    description: 'Start a free Serie A prediction game with your friends — no money, no betting. Italian football as the arena to settle it with your crew.',
    intro: "Tactics, out-of-nowhere goals and iron defences: Italian football rewards those who actually watch the matches. Set up your Serie A prediction game with your friends on PronoHub, for free, and prove you know Italian football better than your mates.",
  },
  {
    slug: 'bundesliga',
    competitionId: 2002,
    dbName: 'Bundesliga',
    name: 'the Bundesliga',
    short: 'Bundesliga',
    title: 'Bundesliga prediction game with friends — free | PronoHub',
    h1: 'Bundesliga predictions with friends',
    description: 'Run a free Bundesliga prediction game with your friends — no betting, no money. Goals galore and German football to challenge your crew every weekend.',
    intro: "The league of packed stadiums and goal-fests is made for predicting. Create your Bundesliga prediction game with your friends on PronoHub: free to set up, one-click invites, and a leaderboard that catches fire from matchday one.",
  },
  {
    slug: 'liga-portugal',
    competitionId: 2017,
    dbName: 'Primeira Liga',
    name: 'the Primeira Liga',
    short: 'Primeira Liga',
    title: 'Primeira Liga prediction game with friends — free | PronoHub',
    h1: 'Primeira Liga predictions with friends',
    description: 'Create a free Primeira Liga (Liga Portugal) prediction game with your friends — no money, no betting. Benfica, Porto, Sporting… your move.',
    intro: "Benfica, Porto, Sporting and tomorrow's wonderkids: the Primeira Liga always has surprises in store. Launch your Portuguese-league prediction game with your friends on PronoHub, for free, and see who rules the title race… prediction edition.",
  },
  {
    slug: 'eredivisie',
    competitionId: 2003,
    dbName: 'Eredivisie',
    name: 'the Eredivisie',
    short: 'Eredivisie',
    title: 'Eredivisie prediction game with friends — free | PronoHub',
    h1: 'Eredivisie predictions with friends',
    description: "Launch a free Eredivisie prediction game with your friends — no betting, no money. Spectacular Dutch football to settle it with your crew.",
    intro: "Ajax, PSV, Feyenoord and attacking football that never stops: the Eredivisie is a joy to predict. Create your Dutch-league prediction game with your friends on PronoHub, for free, and see who best calls the weekend's goal-fests.",
  },
  {
    slug: 'championnat-bresilien',
    competitionId: 2013,
    dbName: 'Campeonato Brasileiro Série A',
    name: 'the Brazilian league',
    short: 'Brasileirão',
    title: 'Brazilian league prediction game with friends — free | PronoHub',
    h1: 'Brazilian league predictions with friends',
    description: 'Create a free Brasileirão prediction game with your friends — no money, no betting. Brazilian football to challenge your crew all season long.',
    intro: "Flamengo, Palmeiras, Corinthians: the Brasileirão is raw passion and results no one can ever call in advance. Set up your Brazilian-league prediction game with your friends on PronoHub, for free, and pit your instincts against your mates'.",
  },
]

export const COMPETITIONS_SEO: Record<'fr' | 'en', CompetitionSeo[]> = { fr: FR, en: EN }

/** Liste des compétitions pour la locale donnée (défaut FR pour rétrocompat). */
export function getCompetitions(locale: 'fr' | 'en' = 'fr'): CompetitionSeo[] {
  return COMPETITIONS_SEO[locale] ?? COMPETITIONS_SEO.fr
}

export function getCompetitionSeo(slug: string, locale: 'fr' | 'en' = 'fr'): CompetitionSeo | undefined {
  return getCompetitions(locale).find((c) => c.slug === slug)
}
