# Configuration du système de thème clair/sombre

## Migration de la base de données

Pour activer le système de thème, vous devez ajouter la colonne `theme_preference` à la table `profiles` dans Supabase.

### Option 1 : Via le SQL Editor de Supabase

1. Allez sur [supabase.com](https://supabase.com) et connectez-vous à votre projet
2. Naviguez vers **SQL Editor** dans le menu de gauche
3. Copiez et exécutez le contenu du fichier `supabase/migrations/add_theme_preference.sql`:

```sql
-- Add theme_preference column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark'));

-- Add comment to column
COMMENT ON COLUMN profiles.theme_preference IS 'User preferred theme (light or dark)';
```

4. Cliquez sur "Run" pour exécuter la migration

### Option 2 : Via la CLI Supabase

Si vous avez la CLI Supabase installée :

```bash
cd C:\Users\mjardin\Desktop\PronoHub
supabase db push
```

## Fonctionnalités du système de thème

### 1. Toggle de thème

Un bouton de bascule de thème est disponible dans la navigation du dashboard. Il permet de basculer instantanément entre les modes clair et sombre.

### 2. Page de profil

La page `/profile` permet à l'utilisateur de :
- Modifier son nom d'utilisateur
- Choisir son thème par défaut (clair ou sombre)
- Enregistrer ses préférences

### 3. Persistance des préférences

Le thème choisi est sauvegardé :
- Dans le `localStorage` du navigateur (pour un chargement rapide)
- Dans la base de données Supabase (pour synchronisation entre appareils)

### 4. Thème par défaut

Le mode **clair** est activé par défaut pour les nouveaux utilisateurs.

## Classes CSS disponibles

Les classes suivantes sont disponibles pour styliser vos composants selon le thème actif :

- `.theme-bg` - Fond adapté au thème
- `.theme-card` - Carte avec fond et bordure adaptés
- `.theme-nav` - Navigation avec fond adapté
- `.theme-text` - Couleur de texte principale
- `.theme-text-secondary` - Couleur de texte secondaire
- `.theme-border` - Couleur de bordure adaptée
- `.theme-input` - Input stylisé selon le thème
- `.theme-btn-primary` - Bouton principal (orange)
- `.theme-btn-secondary` - Bouton secondaire
- `.theme-toggle-btn` - Bouton de toggle de thème

## Variables CSS

Les variables CSS suivantes sont définies et changent automatiquement selon le thème :

```css
--background
--foreground
--card-bg
--nav-bg
--border-color
--text-primary
--text-secondary
--input-bg
--input-border
```

## Utilisation dans les composants

### Client Components

```tsx
'use client'

import { useTheme } from '@/contexts/ThemeContext'

export default function MyComponent() {
  const { theme, setTheme, toggleTheme } = useTheme()

  return (
    <div className="theme-card">
      <h1 className="theme-text">Titre</h1>
      <p className="theme-text-secondary">Description</p>
      <button onClick={toggleTheme}>Changer de thème</button>
    </div>
  )
}
```

### Server Components

Les server components peuvent passer le thème aux client components via props si nécessaire.

## Pages mises à jour

- ✅ `/dashboard` - Dashboard principal avec toggle de thème et lien profil
- ✅ `/profile` - Page de gestion du profil utilisateur
- ⏳ Autres pages à venir...

## Notes

- Le système utilise l'attribut `data-theme` sur la balise `<html>` pour gérer les thèmes
- Les transitions sont animées pour une expérience utilisateur fluide
- Le thème est chargé avant le rendu pour éviter le flash de contenu non stylisé
