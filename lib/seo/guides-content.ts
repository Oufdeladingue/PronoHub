/**
 * Guides evergreen SEO (/guides/[slug]). Contenu FR rédigé à la main : intentions
 * informationnelles à fort volume, qui pointent vers /pronostics/* et convertissent.
 *
 * Bilingue FR/EN : `GUIDES` est un Record indexé par locale. Les `slug` (URL) et les slugs de
 * `related` sont IDENTIQUES entre les deux langues — on ne casse ni le routing ni le maillage. Le
 * contenu EN est rédigé pour l'intention de recherche anglophone (prediction game with friends,
 * free, no money), pas traduit mot à mot.
 */

export interface GuideSection {
  h2: string
  paragraphs?: string[]
  list?: string[]
}

export interface Guide {
  slug: string
  title: string
  h1: string
  description: string
  lede: string
  sections: GuideSection[]
  faq: { q: string; a: string }[]
  related: string[] // slugs de compétitions à mettre en avant (identiques FR/EN)
}

const FR: Guide[] = [
  {
    slug: 'organiser-tournoi-pronostics-entre-amis',
    title: 'Comment organiser un tournoi de pronostics entre amis | PronoHub',
    h1: 'Comment organiser un tournoi de pronostics entre amis',
    description: 'Le guide complet pour organiser un tournoi de pronostics de foot entre amis : choisir la compétition, fixer les règles, inviter tout le monde et suivre le classement. Gratuit.',
    lede: "Organiser un tournoi de pronostics entre amis, c'est le meilleur moyen de rendre chaque week-end de foot plus intense. Voici comment mettre le tien en place en quelques minutes, sans prise de tête et sans dépenser un centime.",
    sections: [
      {
        h2: '1. Choisis la compétition',
        paragraphs: [
          "Tout part de là. Un championnat qui dure toute la saison (Ligue 1, Premier League, Liga…) est parfait pour un tournoi au long cours, où le suspense monte journée après journée. Un tournoi court et intense ? Vise une phase finale de Ligue des Champions ou une Coupe du Monde.",
          "Le bon réflexe : choisis une compétition que la majorité du groupe suit déjà. Plus les gens connaissent les équipes, plus ils prennent de plaisir à pronostiquer et à se chambrer.",
        ],
      },
      {
        h2: '2. Fixe les règles et le barème',
        paragraphs: [
          "Un tournoi de pronos vit par son barème. Le plus courant : des points pour avoir trouvé le bon résultat (1, N ou 2), et un bonus pour le score exact. Ça récompense à la fois le flair et l'audace.",
          "Tu peux pimenter le tout avec un match bonus (points doublés) ou une prime pour ceux qui pronostiquent tôt. L'important : que les règles soient claires pour tout le monde dès le départ.",
        ],
      },
      {
        h2: '3. Invite tes amis',
        paragraphs: [
          "C'est l'étape qui fait ou défait un tournoi. Le secret : zéro friction. Partage un simple lien (WhatsApp, SMS, groupe…) et laisse tes amis rejoindre en un clic. Plus c'est simple, plus ils viennent.",
          "Vise au moins 3-4 participants pour que la compétition soit vivante. Un tournoi de pronos, ça se joue à plusieurs — c'est la comparaison des classements qui crée l'ambiance.",
        ],
      },
      {
        h2: '4. Suis le classement en direct',
        paragraphs: [
          "Rien de pire qu'un tournoi où personne ne sait qui gagne. Un classement mis à jour automatiquement après chaque match entretient la rivalité et donne envie de revenir vérifier sa position.",
          "Ajoute une pincée de compétition : trophées à débloquer, meilleur pronostiqueur de la journée, remontées spectaculaires… ce sont ces détails qui transforment un simple jeu en rendez-vous attendu.",
        ],
      },
      {
        h2: '5. Fais durer le plaisir',
        paragraphs: [
          "Le chambrage fait partie du jeu. Un espace de discussion où chacun peut charrier le dernier du classement ou fanfaronner après un score exact, et ton tournoi devient un vrai fil rouge entre potes tout au long de la saison.",
        ],
      },
    ],
    faq: [
      { q: 'Faut-il payer pour organiser un tournoi de pronostics ?', a: 'Non. Sur PronoHub, créer un tournoi, inviter tes amis et jouer est 100% gratuit. Des formules payantes existent seulement pour les très grands groupes.' },
      { q: 'Combien de participants faut-il ?', a: 'À partir de 2, mais un tournoi devient vraiment vivant à partir de 3-4 joueurs. La comparaison des classements est ce qui crée le plaisir.' },
      { q: 'Peut-on jouer sans miser d\'argent ?', a: 'Oui, et c\'est même le principe. On joue pour le classement, les trophées et la fierté — jamais pour de l\'argent.' },
    ],
    related: ['ligue-1', 'ligue-des-champions', 'premier-league'],
  },
  {
    slug: 'jeux-de-pronos-groupe-whatsapp',
    title: 'Idées de jeux de pronos pour un groupe WhatsApp | PronoHub',
    h1: 'Idées de jeux de pronos pour un groupe WhatsApp',
    description: 'Ton groupe WhatsApp de potes mérite mieux qu\'un tableur. Découvre les meilleures idées de jeux de pronostics de foot à lancer avec ton groupe, gratuitement.',
    lede: "Ton groupe WhatsApp s'enflamme à chaque match ? Transforme cette énergie en compétition. Voici des idées de jeux de pronos parfaits pour un groupe d'amis — et pourquoi une vraie appli bat le tableur ou les messages à la main.",
    sections: [
      {
        h2: 'Le tournoi de la saison',
        paragraphs: [
          "Le grand classique : chacun pronostique tous les matchs d'un championnat, on marque des points, et le classement se joue sur toute la saison. Idéal pour un groupe qui suit la Ligue 1 ou la Premier League de septembre à mai.",
        ],
      },
      {
        h2: 'Le prono spécial compétition',
        paragraphs: [
          "Pour un événement court et intense : Coupe du Monde, Euro, phase finale de Ligue des Champions. Tout le monde pronostique du premier match à la finale, l'ambiance monte crescendo et on connaît le grand gagnant en quelques semaines.",
        ],
      },
      {
        h2: 'Le défi de la journée',
        paragraphs: [
          "Plus léger : chaque semaine, on ne pronostique que les affiches du week-end. Parfait pour les groupes qui ne veulent pas s'engager sur toute une saison mais adorent se défier match après match.",
        ],
      },
      {
        h2: 'Pourquoi une appli plutôt que WhatsApp à la main ?',
        list: [
          "Fini les scores notés dans un tableur que personne ne met à jour.",
          "Le classement se calcule tout seul après chaque match — zéro dispute sur les points.",
          "Chacun saisit ses pronos où il veut, quand il veut, sans spammer le groupe.",
          "Trophées, statistiques et historique : ce qu'un fil WhatsApp ne pourra jamais offrir.",
        ],
        paragraphs: [
          "Tu gardes ton groupe WhatsApp pour le chambrage, et tu laisses l'appli gérer les pronos et le classement. Le meilleur des deux mondes.",
        ],
      },
    ],
    faq: [
      { q: 'Comment lancer un jeu de pronos avec mon groupe WhatsApp ?', a: 'Crée un tournoi sur PronoHub, choisis la compétition, puis partage le lien d\'invitation directement dans ton groupe WhatsApp. Tes potes rejoignent en un clic.' },
      { q: 'C\'est gratuit ?', a: 'Oui, totalement. Aucun frais pour créer le jeu, inviter le groupe et suivre le classement.' },
      { q: 'Faut-il que tout le monde installe une appli ?', a: 'Non, PronoHub fonctionne aussi depuis le navigateur. Une appli Android existe pour ceux qui préfèrent.' },
    ],
    related: ['ligue-1', 'coupe-du-monde', 'ligue-des-champions'],
  },
  {
    slug: 'regles-bareme-concours-pronostics',
    title: 'Règles et barème d\'un concours de pronostics entre potes | PronoHub',
    h1: 'Règles et barème d\'un concours de pronostics entre potes',
    description: 'Comment fixer les règles et le barème de points d\'un concours de pronostics de foot entre amis : bon résultat, score exact, bonus, égalités. Le guide clair.',
    lede: "Un bon concours de pronostics repose sur des règles claires. Voici comment construire un barème équilibré, qui récompense à la fois la régularité et la prise de risque, sans jamais provoquer de dispute entre potes.",
    sections: [
      {
        h2: 'Le barème de base : le bon résultat',
        paragraphs: [
          "La brique de départ : on gagne des points quand on a trouvé l'issue du match — victoire de l'équipe à domicile, match nul, ou victoire à l'extérieur (1, N, 2). En général 1 point. Simple, lisible, tout le monde comprend.",
        ],
      },
      {
        h2: 'Le score exact : la récompense de l\'audace',
        paragraphs: [
          "Pour départager les joueurs, on ajoute un bonus quand le score pronostiqué est exactement le bon (par exemple 3 points au lieu de 1). C'est ce qui pousse à oser un 2-1 plutôt que de jouer petit bras, et ça crée les plus belles remontées au classement.",
        ],
      },
      {
        h2: 'Les bonus pour pimenter',
        list: [
          "Match bonus : les points d'une affiche choisie sont doublés.",
          "Prime avant-match : quelques points en plus pour ceux qui pronostiquent bien avant le coup d'envoi.",
          "Bonus qualifié : en phase finale, des points pour avoir désigné la bonne équipe qualifiée.",
        ],
      },
      {
        h2: 'Gérer les égalités',
        paragraphs: [
          "En cas d'ex æquo à la fin, prévois un critère de départage annoncé dès le début : nombre de scores exacts trouvés, puis nombre de bons résultats. L'essentiel est que la règle soit connue de tous avant la fin — jamais décidée après coup.",
        ],
      },
      {
        h2: 'Durée et rythme',
        paragraphs: [
          "Décide à l'avance si le concours court sur toute la saison ou sur un nombre de journées défini. Un format court maintient l'attention ; un format long récompense la régularité. Les deux marchent — choisis selon l'appétit de ton groupe.",
        ],
      },
    ],
    faq: [
      { q: 'Quel barème choisir pour débuter ?', a: 'Le plus simple et efficace : 1 point pour le bon résultat (1/N/2) et 3 points pour le score exact. Tu ajusteras ensuite selon les envies du groupe.' },
      { q: 'Faut-il calculer les points à la main ?', a: 'Non. Sur PronoHub, le barème est appliqué automatiquement et le classement se met à jour après chaque match, sans erreur ni dispute.' },
      { q: 'Peut-on personnaliser les règles ?', a: 'Oui, tu peux activer des options comme le match bonus ou la prime avant-match selon le style de jeu que tu veux donner à ton concours.' },
    ],
    related: ['ligue-1', 'serie-a', 'liga'],
  },
]

const EN: Guide[] = [
  {
    slug: 'organiser-tournoi-pronostics-entre-amis',
    title: 'How to set up a football prediction game with friends | PronoHub',
    h1: 'How to set up a football prediction game with friends',
    description: 'The complete guide to running a football prediction game with your friends: pick the competition, set the rules, invite everyone and follow the leaderboard. Free.',
    lede: "Running a prediction game with your friends is the best way to make every football weekend more intense. Here's how to get yours up and running in a few minutes — no hassle, and without spending a penny.",
    sections: [
      {
        h2: '1. Pick the competition',
        paragraphs: [
          "It all starts here. A season-long league (Premier League, Ligue 1, La Liga…) is perfect for a marathon game, where the tension builds matchday after matchday. Want something short and intense? Go for the Champions League knockouts or a World Cup.",
          "Good rule of thumb: pick a competition most of the group already follows. The better people know the teams, the more they enjoy predicting — and winding each other up.",
        ],
      },
      {
        h2: '2. Set the rules and the scoring',
        paragraphs: [
          "A prediction game lives and dies by its scoring. The most common setup: points for calling the right outcome (home win, draw or away win), and a bonus for the exact score. That rewards both instinct and nerve.",
          "You can spice things up with a bonus match (double points) or a reward for those who predict early. What matters most: the rules are clear to everyone from the start.",
        ],
      },
      {
        h2: '3. Invite your friends',
        paragraphs: [
          "This is the step that makes or breaks a game. The secret: zero friction. Share a simple link (WhatsApp, text, group chat…) and let your friends join in one tap. The easier it is, the more of them turn up.",
          "Aim for at least 3-4 players so the contest feels alive. A prediction game is a group thing — it's comparing leaderboards that creates the buzz.",
        ],
      },
      {
        h2: '4. Follow the leaderboard live',
        paragraphs: [
          "Nothing kills a game like nobody knowing who's winning. A leaderboard that updates automatically after every match keeps the rivalry going and makes people come back to check where they stand.",
          "Add a pinch of competition: trophies to unlock, player of the matchday, dramatic comebacks… these are the details that turn a simple game into a weekly must.",
        ],
      },
      {
        h2: '5. Keep the fun going',
        paragraphs: [
          "The banter is part of the game. Give everyone a chat to tease whoever's bottom of the table or gloat after nailing an exact score, and your game becomes a running thread between mates all season long.",
        ],
      },
    ],
    faq: [
      { q: 'Do I have to pay to run a prediction game?', a: 'No. On PronoHub, creating a game, inviting your friends and playing is 100% free. Paid plans only exist for very large groups.' },
      { q: 'How many players do I need?', a: 'From 2, but a game really comes alive with 3-4 players. Comparing leaderboards is what makes it fun.' },
      { q: 'Can we play without betting money?', a: "Yes — that's the whole point. You play for the leaderboard, the trophies and the bragging rights — never for money." },
    ],
    related: ['ligue-1', 'ligue-des-champions', 'premier-league'],
  },
  {
    slug: 'jeux-de-pronos-groupe-whatsapp',
    title: 'Prediction game ideas for a WhatsApp group | PronoHub',
    h1: 'Prediction game ideas for your WhatsApp group',
    description: "Your WhatsApp group of mates deserves better than a spreadsheet. Discover the best football prediction game ideas to run with your group — for free.",
    lede: "Does your WhatsApp group blow up on every match? Turn that energy into a competition. Here are prediction game ideas that are perfect for a group of friends — and why a real app beats a spreadsheet or scoring by hand.",
    sections: [
      {
        h2: 'The season-long tournament',
        paragraphs: [
          "The all-time classic: everyone predicts every match of a league, you score points, and the leaderboard plays out across the whole season. Ideal for a group that follows the Premier League or Ligue 1 from August to May.",
        ],
      },
      {
        h2: 'The one-off tournament',
        paragraphs: [
          "For a short, intense event: World Cup, Euros, Champions League knockouts. Everyone predicts from the first match to the final, the buzz builds and you crown a winner in a few weeks.",
        ],
      },
      {
        h2: 'The matchday challenge',
        paragraphs: [
          "Lighter touch: each week you only predict the weekend's big fixtures. Perfect for groups that don't want to commit to a whole season but love a match-by-match duel.",
        ],
      },
      {
        h2: 'Why an app instead of WhatsApp by hand?',
        list: [
          "No more scores buried in a spreadsheet nobody keeps up to date.",
          "The leaderboard calculates itself after every match — zero arguments over points.",
          "Everyone enters their picks wherever and whenever they want, without spamming the group.",
          "Trophies, stats and history: things a WhatsApp thread will never give you.",
        ],
        paragraphs: [
          "Keep your WhatsApp group for the banter, and let the app handle the predictions and the leaderboard. The best of both worlds.",
        ],
      },
    ],
    faq: [
      { q: 'How do I start a prediction game with my WhatsApp group?', a: 'Create a game on PronoHub, pick the competition, then share the invite link straight into your WhatsApp group. Your mates join in one tap.' },
      { q: 'Is it free?', a: 'Yes, completely. No charge to create the game, invite the group and follow the leaderboard.' },
      { q: 'Does everyone have to install an app?', a: 'No, PronoHub works from the browser too. There is an Android app for those who prefer it.' },
    ],
    related: ['ligue-1', 'coupe-du-monde', 'ligue-des-champions'],
  },
  {
    slug: 'regles-bareme-concours-pronostics',
    title: 'Rules and scoring for a football prediction contest | PronoHub',
    h1: 'Rules and scoring for a prediction contest with mates',
    description: 'How to set the rules and points scoring for a football prediction contest with friends: correct result, exact score, bonuses, tie-breaks. The clear guide.',
    lede: "A good prediction contest is built on clear rules. Here's how to design balanced scoring that rewards both consistency and risk-taking, without ever starting an argument between mates.",
    sections: [
      {
        h2: 'The base scoring: the correct result',
        paragraphs: [
          "The starting block: you earn points when you call the outcome of the match — home win, draw or away win. Usually 1 point. Simple, clear, everyone gets it.",
        ],
      },
      {
        h2: 'The exact score: the reward for nerve',
        paragraphs: [
          "To separate players, you add a bonus when the predicted score is spot on (say 3 points instead of 1). That's what pushes people to back a 2-1 instead of playing it safe, and it creates the best comebacks up the table.",
        ],
      },
      {
        h2: 'Bonuses to spice it up',
        list: [
          "Bonus match: the points from a chosen fixture are doubled.",
          "Early-bird bonus: a few extra points for those who predict well before kick-off.",
          "Qualifier bonus: in the knockouts, points for calling the team that goes through.",
        ],
      },
      {
        h2: 'Handling ties',
        paragraphs: [
          "If players finish level, set a tie-breaker announced from the start: number of exact scores, then number of correct results. The key is that the rule is known to everyone before the end — never decided after the fact.",
        ],
      },
      {
        h2: 'Length and rhythm',
        paragraphs: [
          "Decide up front whether the contest runs the whole season or a set number of matchdays. A short format keeps attention high; a long one rewards consistency. Both work — pick based on your group's appetite.",
        ],
      },
    ],
    faq: [
      { q: 'What scoring should I start with?', a: 'The simplest and most effective: 1 point for the correct result (home/draw/away) and 3 points for the exact score. Tweak it later to suit the group.' },
      { q: 'Do I have to work out the points by hand?', a: 'No. On PronoHub the scoring is applied automatically and the leaderboard updates after every match, with no mistakes and no arguments.' },
      { q: 'Can the rules be customised?', a: 'Yes, you can turn on options like the bonus match or the early-bird bonus depending on the style you want to give your contest.' },
    ],
    related: ['ligue-1', 'serie-a', 'liga'],
  },
]

export const GUIDES: Record<'fr' | 'en', Guide[]> = { fr: FR, en: EN }

/** Liste des guides pour la locale donnée (défaut FR pour rétrocompat). */
export function getGuides(locale: 'fr' | 'en' = 'fr'): Guide[] {
  return GUIDES[locale] ?? GUIDES.fr
}

export function getGuide(slug: string, locale: 'fr' | 'en' = 'fr'): Guide | undefined {
  return getGuides(locale).find((g) => g.slug === slug)
}
