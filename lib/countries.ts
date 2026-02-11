/**
 * Liste des pays avec code ISO 3166-1 alpha-2, nom français et emoji drapeau.
 * Utilisé pour la restriction d'inscription par pays et l'admin settings.
 */

export interface Country {
  code: string   // ISO 3166-1 alpha-2
  name: string   // Nom français
  flag: string   // Emoji drapeau
}

export const COUNTRIES: Country[] = [
  // Europe de l'Ouest
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', flag: '🇧🇪' },
  { code: 'CH', name: 'Suisse', flag: '🇨🇭' },
  { code: 'LU', name: 'Luxembourg', flag: '🇱🇺' },
  { code: 'MC', name: 'Monaco', flag: '🇲🇨' },
  { code: 'DE', name: 'Allemagne', flag: '🇩🇪' },
  { code: 'AT', name: 'Autriche', flag: '🇦🇹' },
  { code: 'NL', name: 'Pays-Bas', flag: '🇳🇱' },
  { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧' },
  { code: 'IE', name: 'Irlande', flag: '🇮🇪' },
  // Europe du Sud
  { code: 'ES', name: 'Espagne', flag: '🇪🇸' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'IT', name: 'Italie', flag: '🇮🇹' },
  { code: 'GR', name: 'Grèce', flag: '🇬🇷' },
  // Europe du Nord
  { code: 'SE', name: 'Suède', flag: '🇸🇪' },
  { code: 'NO', name: 'Norvège', flag: '🇳🇴' },
  { code: 'DK', name: 'Danemark', flag: '🇩🇰' },
  { code: 'FI', name: 'Finlande', flag: '🇫🇮' },
  { code: 'IS', name: 'Islande', flag: '🇮🇸' },
  // Europe de l'Est
  { code: 'PL', name: 'Pologne', flag: '🇵🇱' },
  { code: 'CZ', name: 'Tchéquie', flag: '🇨🇿' },
  { code: 'RO', name: 'Roumanie', flag: '🇷🇴' },
  { code: 'HU', name: 'Hongrie', flag: '🇭🇺' },
  { code: 'HR', name: 'Croatie', flag: '🇭🇷' },
  { code: 'RS', name: 'Serbie', flag: '🇷🇸' },
  // Amérique
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'US', name: 'États-Unis', flag: '🇺🇸' },
  { code: 'MX', name: 'Mexique', flag: '🇲🇽' },
  { code: 'BR', name: 'Brésil', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentine', flag: '🇦🇷' },
  { code: 'CO', name: 'Colombie', flag: '🇨🇴' },
  { code: 'CL', name: 'Chili', flag: '🇨🇱' },
  // Afrique francophone
  { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
  { code: 'CI', name: "Côte d'Ivoire", flag: '🇨🇮' },
  { code: 'CM', name: 'Cameroun', flag: '🇨🇲' },
  { code: 'MA', name: 'Maroc', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algérie', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisie', flag: '🇹🇳' },
  { code: 'CG', name: 'Congo', flag: '🇨🇬' },
  { code: 'CD', name: 'RD Congo', flag: '🇨🇩' },
  { code: 'MG', name: 'Madagascar', flag: '🇲🇬' },
  { code: 'ML', name: 'Mali', flag: '🇲🇱' },
  { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
  { code: 'GN', name: 'Guinée', flag: '🇬🇳' },
  { code: 'GA', name: 'Gabon', flag: '🇬🇦' },
  // Moyen-Orient
  { code: 'TR', name: 'Turquie', flag: '🇹🇷' },
  { code: 'LB', name: 'Liban', flag: '🇱🇧' },
  // Asie / Océanie
  { code: 'JP', name: 'Japon', flag: '🇯🇵' },
  { code: 'KR', name: 'Corée du Sud', flag: '🇰🇷' },
  { code: 'AU', name: 'Australie', flag: '🇦🇺' },
  // DOM-TOM (même code FR pour la plupart, mais certains ont leur propre code)
  { code: 'RE', name: 'La Réunion', flag: '🇷🇪' },
  { code: 'GP', name: 'Guadeloupe', flag: '🇬🇵' },
  { code: 'MQ', name: 'Martinique', flag: '🇲🇶' },
  { code: 'GF', name: 'Guyane française', flag: '🇬🇫' },
  { code: 'YT', name: 'Mayotte', flag: '🇾🇹' },
  { code: 'NC', name: 'Nouvelle-Calédonie', flag: '🇳🇨' },
  { code: 'PF', name: 'Polynésie française', flag: '🇵🇫' },
]

/** Pays autorisés par défaut (francophones principaux) */
export const DEFAULT_ALLOWED_COUNTRIES = ['FR', 'BE', 'CH', 'CA']

/** Retrouver un pays par son code */
export function getCountryByCode(code: string): Country | undefined {
  return COUNTRIES.find(c => c.code === code)
}

/** Retrouver le nom + drapeau d'un pays par son code */
export function getCountryLabel(code: string): string {
  const country = getCountryByCode(code)
  return country ? `${country.flag} ${country.name}` : code
}
