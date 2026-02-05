/**
 * Filtre anti-insultes pour le chat
 * Liste de mots interdits en français (insultes, vulgarités, discriminations)
 */

// Liste de mots interdits (en minuscules, sans accents pour la comparaison)
const BANNED_WORDS = [
  // Insultes courantes
  'connard', 'connasse', 'con', 'conne', 'cons',
  'enculé', 'encule', 'enculer',
  'putain', 'pute', 'putes',
  'salaud', 'salope', 'salopes',
  'merde', 'merdeux', 'merdeuse', 'merdique',
  'bordel',
  'foutre', 'fous-toi', 'va te faire foutre',
  'nique', 'niquer', 'niqué', 'ntm', 'niquetamere',
  'batard', 'bâtard', 'batards',
  'fdp', 'fils de pute',
  'tg', 'ta gueule', 'ferme ta gueule', 'ftg',
  'pd', 'pédé', 'pede', 'tapette',
  'gouine',
  'trouduc', 'trou du cul', 'trouducul',
  'bouffon', 'bouffonne',
  'abruti', 'abrutie', 'abrutis',
  'débile', 'debile',
  'crétin', 'cretin', 'crétine',
  'idiot', 'idiote', 'idiots',
  'imbécile', 'imbecile',
  'taré', 'tare', 'tarée',
  'mongol', 'mongole',
  'attardé', 'attarde', 'attardée',
  'gogol',
  'boloss', 'bolosse',
  'clochard', 'clodo',
  'pouffiasse', 'poufiasse',
  'grognasse',
  'petasse', 'pétasse',
  'trainée', 'trainee',
  'catin',
  'garce',
  'chienne',
  'couille', 'couilles', 'couillon', 'couillonne',
  'branleur', 'branleuse', 'branlette',
  'wesh', // souvent utilisé de manière agressive
  'cassos', 'cas soc', 'cas social',
  'tocard', 'tocarde',
  'naze', 'nases',
  'blaireau',
  'pignouf',
  'andouille',
  'ducon', 'duconne',
  'enfoiré', 'enfoire', 'enfoirée',
  'ordure', 'ordures',
  'raclure',
  'fumier',
  'pourriture',
  'charogne',
  'crevard', 'crevarde',
  'minable', 'minables',
  'looser', 'loser', 'losers',
  'noob', 'noobs', 'newbie',

  // Discriminations raciales/ethniques
  'negre', 'nègre', 'negresse',
  'bougnoule', 'bougnoul',
  'arabe', // seulement si utilisé comme insulte
  'youpin', 'youpine',
  'feuj',
  'rebeu', 'reubeu',
  'niafou',
  'chinetoque', 'chintok',
  'bridé', 'bride',
  'bamboula',
  'macaque',
  'raton',
  'melon',
  'bicot',
  'crouille',
  'espingouin',
  'ritale', 'rital',
  'polak', 'polack',
  'rosbif',
  'boche',
  'schleu',

  // Homophobie/Transphobie
  'fiotte',
  'tarlouze', 'tarlouse',
  'tantouze', 'tantouse',
  'travelo',
  'trans', // seulement si utilisé comme insulte

  // Sexisme
  'salope',
  'chaudasse',
  'marie-couche-toi-la',

  // Menaces
  'je vais te tuer',
  'je te tue',
  'creve', 'crève',
  'suicide-toi', 'suicide toi',
  'va mourir',

  // Variantes avec caractères spéciaux (contournements courants)
  'c0nnard', 'c0n', 'c0nne',
  'put1', 'put@in',
  'n1que', 'n1quer',
  'p3d3', 'p.d',
  'f.d.p', 'f d p',
  'enc*lé', 'encu1é',
]

// Mots autorisés qui contiennent des sous-chaînes interdites
const ALLOWED_WORDS = [
  'consommation', 'consommer', 'console', 'consoler', 'conseil', 'conseiller',
  'constat', 'constater', 'constant', 'constellation', 'construction', 'construire',
  'contact', 'contacter', 'conte', 'conter', 'contenu', 'contenir',
  'contexte', 'continent', 'continuer', 'continuation', 'contrat',
  'contraire', 'contre', 'contrer', 'contribution', 'controle', 'controler',
  'concert', 'concerner', 'conception', 'conclure', 'conclusion',
  'concours', 'concret', 'condition', 'conduire', 'conduite',
  'conference', 'confiance', 'confier', 'confirmer', 'conflit',
  'confort', 'confortable', 'confusion', 'connaissance', 'connaitre', 'connaître',
  'connexion', 'connu', 'conscience', 'consecutif',
  'putatif', 'putative', // termes juridiques
  'repu', 'repue', // rassasié
  'dispute', 'disputer',
  'imputer', 'imputé',
  'computer', 'computing',
  'tarentule', // araignée
  'contestation', 'contester',
  'mécontentement', 'mécontent',
  'reconnu', 'reconnaissance',
  'second', 'seconde', 'secondaire',
  'fécond', 'féconde', 'fécondité',
  'économie', 'économique',
  'condoléances',
  'arabesques', // motifs décoratifs
]

/**
 * Normalise un texte pour la comparaison (minuscules, sans accents)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[0-9@!$%*]/g, (char) => {
      // Remplace les caractères de substitution courants
      const replacements: Record<string, string> = {
        '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
        '@': 'a', '!': 'i', '$': 's', '%': '', '*': ''
      }
      return replacements[char] || char
    })
}

/**
 * Vérifie si un mot est dans la liste des mots autorisés
 */
function isAllowedWord(word: string): boolean {
  const normalizedWord = normalizeText(word)
  return ALLOWED_WORDS.some(allowed =>
    normalizeText(allowed) === normalizedWord
  )
}

/**
 * Vérifie si un message contient des mots interdits
 * @returns { isClean: boolean, detectedWords: string[] }
 */
export function checkMessage(message: string): { isClean: boolean; detectedWords: string[] } {
  const normalizedMessage = normalizeText(message)
  const detectedWords: string[] = []

  // Séparer en mots pour vérifier les mots autorisés
  const words = message.split(/\s+/)

  for (const bannedWord of BANNED_WORDS) {
    const normalizedBanned = normalizeText(bannedWord)

    // Vérifier si le mot interdit est présent
    if (normalizedMessage.includes(normalizedBanned)) {
      // Vérifier si c'est un faux positif (mot autorisé)
      const isFalsePositive = words.some(word => isAllowedWord(word))

      if (!isFalsePositive) {
        // Vérification supplémentaire: le mot interdit doit être un mot entier
        // ou faire partie d'un mot non autorisé
        const regex = new RegExp(`(^|[^a-z])${normalizedBanned}([^a-z]|$)`, 'i')
        if (regex.test(normalizedMessage) || normalizedBanned.length >= 4) {
          detectedWords.push(bannedWord)
        }
      }
    }
  }

  return {
    isClean: detectedWords.length === 0,
    detectedWords: [...new Set(detectedWords)] // Dédoublonner
  }
}

/**
 * Censure les mots interdits dans un message (remplace par des *)
 * Utile si on veut afficher le message censuré plutôt que le bloquer
 */
export function censorMessage(message: string): string {
  let censoredMessage = message

  for (const bannedWord of BANNED_WORDS) {
    const regex = new RegExp(bannedWord, 'gi')
    censoredMessage = censoredMessage.replace(regex, (match) =>
      match[0] + '*'.repeat(match.length - 2) + match[match.length - 1]
    )
  }

  return censoredMessage
}
