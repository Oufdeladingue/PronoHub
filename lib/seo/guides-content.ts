/**
 * Guides evergreen SEO (/guides/[slug]). Contenu FR rédigé à la main : intentions
 * informationnelles à fort volume, qui pointent vers /pronostics/* et convertissent.
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
  related: string[] // slugs de compétitions à mettre en avant
}

export const GUIDES: Guide[] = [
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

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug)
}
