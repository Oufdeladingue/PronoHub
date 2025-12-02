# Règles de développement - PronoHub

Ce fichier contient les règles et bonnes pratiques à suivre lors du développement sur PronoHub.

## 1. Gestion des styles CSS et thèmes

### Règle principale : Réutiliser les classes CSS existantes

**TOUJOURS** vérifier si une classe CSS existe déjà dans `app/globals.css` avant d'ajouter des styles inline ou de créer une nouvelle classe.

### Classes utilitaires thématiques disponibles

#### Couleurs d'accent
- `.theme-accent-text` - Texte accent (orange en dark, bleu en light)
- `.theme-accent-bg` - Background accent
- `.theme-accent-border` - Bordure accent
- `.theme-accent-text-always` - Texte orange dans les deux thèmes

#### Backgrounds thématiques
- `.theme-bg` - Background principal de la page
- `.theme-card` - Style complet de carte (bg, border, padding, shadow)
- `.theme-nav` - Background de navigation
- `.theme-secondary-bg` - Background secondaire (#ffffff / #1e293b)
- `.theme-dark-bg` - Background sombre (#f9fafb / #0f172a)

#### Textes thématiques
- `.theme-text` - Texte principal
- `.theme-text-secondary` - Texte secondaire
- `.theme-secondary-text` - Texte couleur secondaire
- `.theme-slate-text` - Texte gris-bleu (#94a3b8)

#### Bordures thématiques
- `.theme-border` - Bordure standard
- `.theme-secondary-border` - Bordure secondaire
- `.theme-dark-border` - Bordure sombre

#### Inputs et boutons
- `.theme-input` - Style complet d'input
- `.theme-btn-primary` - Bouton primaire (orange)
- `.theme-btn-secondary` - Bouton secondaire
- `.theme-toggle-btn` - Bouton toggle

#### Filtres d'icônes
- `.icon-filter-orange` - Filtre pour icônes accent
- `.icon-filter-white` - Filtre pour icônes blanches
- `.icon-filter-theme` - Filtre adaptatif au thème
- `.icon-filter-slate` - Filtre gris-bleu
- `.icon-filter-premium` - Filtre premium

#### Cartes et conteneurs
- `.glossy-card` - Carte avec effet hover
- `.stat-card` - Carte de statistique
- `.trophy-card` - Carte de trophée
- `.pref-item` - Item de préférence/paramètre
- `.logo-container` - Conteneur de logo avec fond au survol

#### Logos de compétition
- `.logo-competition-white` - Logo blanc (visible par défaut en dark, au survol en light)
- `.logo-competition-color` - Logo couleur (au survol en dark, par défaut en light)

#### Badges
- `.status-badge` - Badge de statut
- `.badge-finished` - Badge "Terminé"
- `.badge-left` - Badge "Quitté"

#### Navigation
- `.nav-icon-btn` - Bouton icône de navigation
- `.nav-greeting` - Texte de salutation

### Processus avant d'ajouter du style

1. **Chercher une classe existante** dans `globals.css`
2. **Si elle existe** : l'utiliser directement
3. **Si elle n'existe pas mais est réutilisable** : créer une nouvelle classe dans `globals.css`
4. **Si c'est un cas unique** : utiliser du style inline (dernier recours)

### Exemple

```tsx
// ❌ MAUVAIS - Style inline répétitif
<div className="bg-[#0f172a] text-[#ff9900] border border-[#ff9900]">

// ✅ BON - Utiliser les classes existantes
<div className="theme-dark-bg theme-accent-text theme-accent-border">
```

## 2. Pages d'authentification

Les pages d'authentification (login, signup, verify-code, verify-email, choose-username, page d'accueil) doivent :
- Utiliser la classe `.auth-page` sur le conteneur principal
- Rester en thème sombre avec les couleurs orange originales
- Ne pas être affectées par le thème clair

## 3. Palette de couleurs

Voir `docs/THEME_CLAIR_COLORS.md` pour la palette complète du thème clair.

### Thème sombre (par défaut)
- Background : `#0f172a`
- Cartes : `#1e293b`
- Accent : `#ff9900`
- Texte : `#f1f5f9`

### Thème clair
- Background : `#F2F4F7` (Gris glacier)
- Cartes/Nav : `#FFFFFF` (Blanc)
- Accent principal : `#FF9900` (Orange)
- Accent secondaire : `#0055FF` (Bleu élite)
- Titres : `#243447` (Graphite bleu)

## 4. Conventions de nommage des classes

- Préfixe `theme-` pour les classes adaptatives aux deux thèmes
- Préfixe `dark-` pour les classes spécifiques au thème sombre
- Préfixe `icon-filter-` pour les filtres d'icônes
- Préfixe `btn-` pour les boutons
- Préfixe `badge-` pour les badges

## 5. Structure des fichiers CSS

Dans `globals.css` :
1. Variables CSS (`:root[data-theme="light"]` et `:root[data-theme="dark"]`)
2. Styles de base (body, html)
3. Classes utilitaires thématiques
4. Composants spécifiques
5. Section "THÈME CLAIR - STYLES SPÉCIFIQUES" pour les overrides
6. Section "PAGES D'AUTHENTIFICATION" pour les exceptions auth
