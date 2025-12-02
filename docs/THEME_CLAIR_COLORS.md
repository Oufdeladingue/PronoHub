# Palette de couleurs - Thème Clair PronoHub

## Couleurs principales

| Rôle | Nom | Hexa | Usage |
|------|-----|------|-------|
| ⚡ Accent principal | Orange | `#FF9900` | Boutons primaires, liens actifs, éléments d'action, hover |
| 🔵 Accent secondaire fort | Bleu élite | `#0055FF` | Éléments secondaires, badges, bordures accent |
| ⚫ Titres soft | Graphite bleu | `#243447` | Titres, textes principaux, labels importants |
| 🌫️ Fond page | Gris ardoise | `#D0D6DE` | Background général de la page (contraste avec cartes) |
| 🕊️ Fond cartes | Blanc | `#FFFFFF` | Cartes principales, navigation, conteneurs, sections |

## Variables CSS correspondantes

```css
:root[data-theme="light"] {
  --background: #D0D6DE;        /* Gris ardoise - fond général (contraste) */
  --foreground: #243447;        /* Graphite bleu - texte principal */
  --card-bg: #FFFFFF;           /* Blanc - fond des cartes */
  --nav-bg: #FFFFFF;            /* Blanc - fond navigation */
  --accent-primary: #FF9900;    /* Orange - accent principal */
  --accent-secondary: #0055FF;  /* Bleu élite - accent secondaire */
  --text-primary: #243447;      /* Graphite bleu - titres */
  --text-secondary: #64748b;    /* Gris slate - texte secondaire */
}
```

## Guide d'utilisation

### Accent principal (Orange #FF9900)
- Boutons d'action principaux (CTA)
- Liens au survol
- Bordures actives
- Icônes d'action
- Badges importants

### Accent secondaire (Bleu élite #0055FF)
- Badges de statut
- Bordures secondaires
- Liens secondaires
- Éléments informatifs
- Icônes secondaires

### Graphite bleu (#243447)
- Titres de page
- Titres de sections
- Texte principal important
- Labels de formulaires

### Gris ardoise (#D0D6DE)
- Background général de la page
- Crée le contraste avec les cartes blanches
- Séparateurs visuels

### Blanc (#FFFFFF)
- Cartes de contenu
- Navigation
- Modales
- Inputs

## Notes importantes

- Le thème sombre garde l'orange `#FF9900` comme accent principal
- En thème clair, on utilise aussi l'orange mais avec le bleu élite pour certains éléments secondaires
- Les bordures utilisent `#6B7280` (gray-500) pour une bonne visibilité
- Le texte secondaire reste `#64748b` (slate-500) pour un bon contraste
