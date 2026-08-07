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

const ES: Guide[] = [
  {
    slug: 'organiser-tournoi-pronostics-entre-amis',
    title: 'Cómo organizar un juego de pronósticos de fútbol entre amigos | PronoHub',
    h1: 'Cómo organizar un juego de pronósticos de fútbol entre amigos',
    description: 'La guía completa para montar una porra de fútbol entre amigos: elegir la competición, fijar las reglas, invitar a todos y seguir la clasificación en directo. Gratis.',
    lede: "Organizar un juego de pronósticos entre amigos es la mejor forma de vivir cada jornada de fútbol con más intensidad. Así puedes montar el tuyo en unos minutos, sin complicaciones y sin gastarte un euro.",
    sections: [
      {
        h2: '1. Elige la competición',
        paragraphs: [
          "Todo empieza aquí. Una liga que dura toda la temporada (LaLiga, Premier League, Ligue 1…) es perfecta para una porra de largo recorrido, donde la emoción crece jornada tras jornada. ¿Quieres algo corto e intenso? Apunta a las eliminatorias de la Champions League o a un Mundial.",
          "El buen consejo: elige una competición que la mayoría del grupo ya siga. Cuanto mejor conozca la gente a los equipos, más disfruta pronosticando y picándose entre sí.",
        ],
      },
      {
        h2: '2. Fija las reglas y la puntuación',
        paragraphs: [
          "Una porra de pronósticos vive por su sistema de puntos. Lo más habitual: puntos por acertar el resultado (1, X o 2) y un extra por el resultado exacto. Así se premia tanto el olfato como la valentía.",
          "Puedes darle chispa con un partido bonus (puntos dobles) o una prima para quienes pronostican pronto. Lo importante: que las reglas queden claras para todos desde el principio.",
        ],
      },
      {
        h2: '3. Invita a tus amigos',
        paragraphs: [
          "Esta es la etapa que hace o deshace una porra. El secreto: cero fricción. Comparte un simple enlace (WhatsApp, SMS, grupo…) y deja que tus amigos se unan con un clic. Cuanto más fácil, más gente se apunta.",
          "Apunta al menos a 3-4 participantes para que la competición esté viva. Una porra se juega en grupo: es la comparación de clasificaciones lo que crea el ambiente.",
        ],
      },
      {
        h2: '4. Sigue la clasificación en directo',
        paragraphs: [
          "No hay nada peor que una porra donde nadie sabe quién va ganando. Una clasificación que se actualiza automáticamente después de cada partido mantiene viva la rivalidad y dan ganas de volver a mirar tu posición.",
          "Añade una pizca de competición: trofeos por desbloquear, mejor pronosticador de la jornada, remontadas espectaculares… son esos detalles los que convierten un simple juego en una cita esperada.",
        ],
      },
      {
        h2: '5. Haz que dure la diversión',
        paragraphs: [
          "El pique forma parte del juego. Un espacio para charlar donde cada uno pueda vacilar al último de la clasificación o presumir tras clavar un resultado exacto, y tu porra se convierte en un hilo conductor entre amigos durante toda la temporada.",
        ],
      },
    ],
    faq: [
      { q: '¿Hay que pagar para organizar un juego de pronósticos?', a: 'No. En PronoHub, crear una porra, invitar a tus amigos y jugar es 100% gratis. Solo existen planes de pago para grupos muy grandes.' },
      { q: '¿Cuántos participantes hacen falta?', a: 'A partir de 2, pero una porra cobra vida de verdad a partir de 3-4 jugadores. La comparación de clasificaciones es lo que genera la diversión.' },
      { q: '¿Se puede jugar sin apostar dinero?', a: 'Sí, y es justo la idea. Se juega por la clasificación, los trofeos y el orgullo, nunca por dinero.' },
    ],
    related: ['ligue-1', 'ligue-des-champions', 'premier-league'],
  },
  {
    slug: 'jeux-de-pronos-groupe-whatsapp',
    title: 'Ideas de juegos de pronósticos para un grupo de WhatsApp | PronoHub',
    h1: 'Ideas de juegos de pronósticos para tu grupo de WhatsApp',
    description: 'Tu grupo de WhatsApp de amigos merece algo mejor que una hoja de cálculo. Descubre las mejores ideas de porras de fútbol para lanzar con tu grupo, gratis.',
    lede: "¿Tu grupo de WhatsApp se enciende con cada partido? Convierte esa energía en competición. Aquí tienes ideas de juegos de pronósticos perfectas para un grupo de amigos, y por qué una app de verdad gana a la hoja de cálculo o a apuntar los puntos a mano.",
    sections: [
      {
        h2: 'La porra de la temporada',
        paragraphs: [
          "El gran clásico: cada uno pronostica todos los partidos de una liga, se suman puntos, y la clasificación se decide durante toda la temporada. Ideal para un grupo que sigue LaLiga o la Premier League de agosto a mayo.",
        ],
      },
      {
        h2: 'El pronóstico de competición especial',
        paragraphs: [
          "Para un evento corto e intenso: Mundial, Eurocopa, eliminatorias de la Champions League. Todos pronostican del primer partido a la final, el ambiente sube en crescendo y se conoce al gran ganador en unas semanas.",
        ],
      },
      {
        h2: 'El reto de la jornada',
        paragraphs: [
          "Más ligero: cada semana solo se pronostican los partidazos del fin de semana. Perfecto para grupos que no quieren comprometerse toda una temporada pero adoran picarse partido a partido.",
        ],
      },
      {
        h2: '¿Por qué una app en lugar de WhatsApp a mano?',
        list: [
          "Se acabaron los marcadores apuntados en una hoja de cálculo que nadie actualiza.",
          "La clasificación se calcula sola después de cada partido: cero discusiones por los puntos.",
          "Cada uno mete sus pronósticos donde quiera y cuando quiera, sin saturar el grupo.",
          "Trofeos, estadísticas e historial: lo que un hilo de WhatsApp nunca podrá ofrecer.",
        ],
        paragraphs: [
          "Te quedas con tu grupo de WhatsApp para el pique, y dejas que la app gestione los pronósticos y la clasificación. Lo mejor de los dos mundos.",
        ],
      },
    ],
    faq: [
      { q: '¿Cómo lanzo un juego de pronósticos con mi grupo de WhatsApp?', a: 'Crea una porra en PronoHub, elige la competición y comparte el enlace de invitación directamente en tu grupo de WhatsApp. Tus amigos se unen con un clic.' },
      { q: '¿Es gratis?', a: 'Sí, totalmente. Sin coste para crear el juego, invitar al grupo y seguir la clasificación.' },
      { q: '¿Todos tienen que instalar una app?', a: 'No, PronoHub también funciona desde el navegador. Existe una app de Android para quienes la prefieran.' },
    ],
    related: ['ligue-1', 'coupe-du-monde', 'ligue-des-champions'],
  },
  {
    slug: 'regles-bareme-concours-pronostics',
    title: 'Reglas y puntuación de un concurso de pronósticos entre amigos | PronoHub',
    h1: 'Reglas y puntuación de un concurso de pronósticos entre amigos',
    description: 'Cómo fijar las reglas y la puntuación de un concurso de pronósticos de fútbol entre amigos: acierto de resultado, resultado exacto, bonus, empates. La guía clara.',
    lede: "Un buen concurso de pronósticos se apoya en reglas claras. Así puedes construir un sistema de puntos equilibrado, que premie tanto la regularidad como la valentía, sin provocar jamás una discusión entre amigos.",
    sections: [
      {
        h2: 'La puntuación básica: el resultado acertado',
        paragraphs: [
          "El ladrillo de partida: se ganan puntos cuando aciertas el desenlace del partido: victoria local, empate o victoria visitante (1, X, 2). Normalmente 1 punto. Sencillo, claro, todos lo entienden.",
        ],
      },
      {
        h2: 'El resultado exacto: la recompensa a la valentía',
        paragraphs: [
          "Para desempatar a los jugadores, se añade un extra cuando el resultado pronosticado es exactamente el correcto (por ejemplo 3 puntos en vez de 1). Es lo que empuja a atreverse con un 2-1 en lugar de jugar a lo seguro, y crea las mejores remontadas en la clasificación.",
        ],
      },
      {
        h2: 'Los bonus para darle chispa',
        list: [
          "Partido bonus: los puntos de un partido elegido se duplican.",
          "Prima anticipada: unos puntos extra para quienes pronostican mucho antes del pitido inicial.",
          "Bonus clasificado: en las eliminatorias, puntos por acertar el equipo que pasa de ronda.",
        ],
      },
      {
        h2: 'Gestionar los empates',
        paragraphs: [
          "En caso de empate al final, prevé un criterio de desempate anunciado desde el principio: número de resultados exactos acertados, luego número de resultados acertados. Lo esencial es que la regla la conozcan todos antes del final, nunca decidida a posteriori.",
        ],
      },
      {
        h2: 'Duración y ritmo',
        paragraphs: [
          "Decide de antemano si el concurso dura toda la temporada o un número concreto de jornadas. Un formato corto mantiene la atención; uno largo premia la regularidad. Los dos funcionan: elige según las ganas de tu grupo.",
        ],
      },
    ],
    faq: [
      { q: '¿Qué puntuación elegir para empezar?', a: 'La más sencilla y eficaz: 1 punto por el resultado acertado (1/X/2) y 3 puntos por el resultado exacto. Luego la ajustas según los gustos del grupo.' },
      { q: '¿Hay que calcular los puntos a mano?', a: 'No. En PronoHub la puntuación se aplica automáticamente y la clasificación se actualiza después de cada partido, sin errores ni discusiones.' },
      { q: '¿Se pueden personalizar las reglas?', a: 'Sí, puedes activar opciones como el partido bonus o la prima anticipada según el estilo de juego que quieras darle a tu concurso.' },
    ],
    related: ['ligue-1', 'serie-a', 'liga'],
  },
]

export const GUIDES: Partial<Record<string, Guide[]>> & { fr: Guide[] } = { fr: FR, en: EN, es: ES }

/** Liste des guides pour la locale donnée (repli FR si langue non traduite). */
export function getGuides(locale: string = 'fr'): Guide[] {
  return GUIDES[locale] ?? GUIDES.fr
}

export function getGuide(slug: string, locale: string = 'fr'): Guide | undefined {
  return getGuides(locale).find((g) => g.slug === slug)
}
