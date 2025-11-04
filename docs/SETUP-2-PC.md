# Configuration pour travailler sur 2 PC avec Supabase Local

## Concept

Chaque PC aura sa **propre instance Supabase locale** :
- PC Travail : Supabase local + Inbucket
- PC Maison : Supabase local + Inbucket

Les deux partagent :
- ✅ Le code (via Git)
- ✅ Les migrations SQL (versionnées dans `supabase/migrations/`)
- ✅ La configuration (`supabase/config.toml`)
- ❌ PAS la base de données locale (chaque PC a sa propre DB)

## Installation sur chaque PC

### PC 1 (Travail)

```bash
# 1. Installer Docker Desktop
# Télécharger : https://www.docker.com/products/docker-desktop

# 2. Installer Supabase CLI (PowerShell)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# 3. Cloner le projet (si pas déjà fait)
cd C:\projets
git clone https://github.com/Oufdeladingue/PronoHub.git
cd PronoHub

# 4. Installer les dépendances
npm install

# 5. Initialiser Supabase (une seule fois)
supabase init

# 6. Démarrer Supabase
supabase start

# 7. Créer le fichier .env.local avec les clés locales
# (copier les clés affichées par supabase start)
```

### PC 2 (Maison)

```bash
# 1. Installer Docker Desktop (même que PC1)

# 2. Installer Supabase CLI (même que PC1)

# 3. Cloner le projet
cd C:\projets
git clone https://github.com/Oufdeladingue/PronoHub.git
cd PronoHub

# 4. Installer les dépendances
npm install

# 5. Supabase est DÉJÀ initialisé (via Git)
# Le dossier supabase/ est versionné !

# 6. Démarrer Supabase
supabase start

# 7. Créer le fichier .env.local avec les clés locales
```

## Workflow Git adapté

### Fichiers à versionner (déjà dans .gitignore)

✅ **À COMMITER** :
- `supabase/config.toml` : Configuration Supabase
- `supabase/migrations/*.sql` : Migrations SQL
- `supabase/seed.sql` : Données de test
- `docs/*.md` : Documentation

❌ **NE JAMAIS COMMITER** :
- `.env.local` : Clés locales (diffèrent sur chaque PC)
- `supabase/.branches/` : État local
- `supabase/.temp/` : Fichiers temporaires

### Mettre à jour le .gitignore

Ajoutez ces lignes dans `.gitignore` :

```
# Supabase local
.env.local
supabase/.branches
supabase/.temp
```

## Workflow quotidien adapté

### Sur PC 1 (matin au travail)

```bash
# 1. Récupérer les changements
git pull

# 2. Démarrer Supabase
supabase start

# 3. Appliquer les nouvelles migrations (si il y en a)
supabase db reset  # Recrée la DB avec toutes les migrations

# 4. Lancer l'app
npm run dev

# 5. Travailler...

# 6. Si vous modifiez la DB, créer une migration
supabase db diff -f nouvelle_table

# 7. Commiter AVEC les migrations
git add .
git commit -m "feat: Ajout table xyz"
git push

# 8. Arrêter Supabase (optionnel, économise RAM)
supabase stop
```

### Sur PC 2 (soir à la maison)

```bash
# 1. Récupérer les changements (avec les migrations du PC1)
git pull

# 2. Démarrer Supabase
supabase start

# 3. Appliquer les migrations du PC1
supabase db reset

# 4. Lancer l'app
npm run dev

# 5. Travailler...

# 6. Commiter vos changements
git add .
git commit -m "feat: Nouvelle fonctionnalité"
git push

# 7. Arrêter Supabase
supabase stop
```

## Synchroniser les changements de schéma

### Scénario : Vous modifiez la DB sur PC1

**Sur PC1** :

```bash
# Vous avez modifié la DB via Studio (http://localhost:54323)
# Créer une migration avec les changements
supabase db diff -f add_new_column

# Vérifier le fichier créé
cat supabase/migrations/20250104120000_add_new_column.sql

# Commiter
git add supabase/migrations/
git commit -m "db: Ajout colonne xyz"
git push
```

**Sur PC2** :

```bash
# Récupérer les changements
git pull

# Appliquer la nouvelle migration
supabase db reset

# Votre DB locale est maintenant à jour !
```

## Gestion des données de test (seed)

### Créer des données de test partagées

**Sur PC1** :

```bash
# Créer des données via Studio ou SQL

# Exporter en seed
supabase db dump --data-only -f supabase/seed.sql

# Commiter
git add supabase/seed.sql
git commit -m "chore: Update seed data"
git push
```

**Sur PC2** :

```bash
git pull

# Réinitialiser avec les nouvelles données
supabase db reset  # Applique automatiquement seed.sql
```

## Variables d'environnement

### Créer un template

Créez `.env.local.template` (à versionner) :

```env
# Supabase Local
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<copier-depuis-supabase-start>

# API Football
FOOTBALL_DATA_API_KEY=<votre-clé-commune>
```

### Sur chaque PC

Copiez le template et remplissez :

```bash
cp .env.local.template .env.local
# Éditer .env.local avec les clés affichées par "supabase start"
```

## Avantages de cette approche

✅ **Indépendance** : Chaque PC a sa propre DB, pas de conflits
✅ **Migrations versionnées** : Les changements de schéma passent par Git
✅ **Emails locaux** : Inbucket sur chaque PC (pas de dépendance cloud)
✅ **Pas de consommation cloud** : Tests gratuits illimités
✅ **Reproductibilité** : Même environnement sur les 2 PC

## Exemple complet : Ajouter une table

### Sur PC 1 (Travail)

```bash
# 1. Démarrer Supabase
supabase start

# 2. Créer la table via Studio
# http://localhost:54323 > Table Editor > New Table
# Nom : "user_preferences"
# Colonnes : id (uuid), user_id (uuid), theme (text)

# 3. Générer la migration
supabase db diff -f add_user_preferences

# 4. Vérifier le contenu
cat supabase/migrations/20250104143000_add_user_preferences.sql

# 5. Commiter
git add supabase/migrations/
git commit -m "db: Add user_preferences table"
git push
```

### Sur PC 2 (Maison)

```bash
# 1. Récupérer les changements
git pull

# 2. Démarrer Supabase
supabase start

# 3. Appliquer la migration
supabase db reset

# La table "user_preferences" existe maintenant sur PC2 !
```

## Commandes utiles

```bash
# Voir les migrations appliquées
supabase migration list

# Créer une migration manuelle
supabase migration new nom_de_la_migration

# Réinitialiser complètement la DB
supabase db reset

# Voir le diff SQL depuis la dernière migration
supabase db diff

# Vérifier que les migrations sont à jour sur les 2 PC
git log supabase/migrations/
```

## Résolution de problèmes

### Problème : Les 2 PC ont des migrations différentes

**Cause** : Vous avez créé une migration sur PC1 et PC2 sans pull

**Solution** :

```bash
# Sur le PC qui a pushé en dernier
git pull

# Résoudre les conflits dans supabase/migrations/
# Renommer les fichiers si nécessaire (timestamp unique)

# Commiter la résolution
git add supabase/migrations/
git commit -m "fix: Merge migrations"
git push
```

### Problème : "Migration already exists"

**Cause** : Vous essayez de créer une migration avec le même nom

**Solution** : Le timestamp dans le nom de fichier doit être unique. Attendez 1 seconde et réessayez.

### Problème : Données de test différentes sur les 2 PC

**Solution** : Utilisez `seed.sql` versionné dans Git

```bash
# Sur le PC de référence
supabase db dump --data-only -f supabase/seed.sql
git add supabase/seed.sql
git push

# Sur l'autre PC
git pull
supabase db reset  # Applique seed.sql automatiquement
```

## Récapitulatif

| Aspect | Solution |
|--------|----------|
| **Code** | Git (partagé) |
| **Base de données** | Locale sur chaque PC |
| **Schéma DB** | Migrations SQL versionnées (Git) |
| **Données test** | seed.sql versionné (Git) |
| **Configuration** | config.toml versionné (Git) |
| **Emails** | Inbucket local (chaque PC) |
| **Clés API** | .env.local (NON versionné, différent par PC) |

## Workflow recommandé pour 2 PC

```bash
# MATIN (PC Travail)
git pull
supabase start
npm run dev

# Développement...

# SOIR (avant de partir)
git add .
git commit -m "Description"
git push
supabase stop

# SOIR (PC Maison)
git pull
supabase start
supabase db reset  # Important !
npm run dev

# Développement...

# NUIT (avant de dormir)
git add .
git commit -m "Description"
git push
supabase stop
```

## Conseil important

⚠️ **Toujours faire `supabase db reset` après un `git pull`**

Cela garantit que votre schéma local correspond exactement aux migrations Git.

---

Cette approche vous permet de travailler de manière fluide sur 2 PC tout en gardant vos environnements synchronisés via Git !
