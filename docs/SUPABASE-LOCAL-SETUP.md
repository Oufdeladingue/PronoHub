# Configuration Supabase CLI Local

## Pourquoi Supabase CLI local ?

- ✅ **Inbucket inclus** : Serveur SMTP de test intégré
- ✅ **Base de données locale** : PostgreSQL avec vos schémas
- ✅ **Auth locale** : Système d'authentification complet
- ✅ **Pas de consommation cloud** : Tests gratuits illimités
- ✅ **Offline** : Travaillez sans connexion internet

## Installation de Supabase CLI sur Windows

### Option 1 : Via Scoop (Recommandé)

**Étape 1 : Installer Scoop** (si pas déjà installé)

Ouvrez PowerShell et exécutez :

```powershell
# Autoriser l'exécution de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Installer Scoop
Invoke-RestMethod -Uri https://get.scoop.sh | Invoke-Expression
```

**Étape 2 : Installer Supabase CLI**

```powershell
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

**Étape 3 : Vérifier l'installation**

```bash
supabase --version
```

### Option 2 : Téléchargement direct

1. Allez sur : https://github.com/supabase/cli/releases
2. Téléchargez `supabase_windows_amd64.zip`
3. Extrayez le fichier dans `C:\Program Files\Supabase\`
4. Ajoutez le chemin aux variables d'environnement :
   - Panneau de configuration > Système > Paramètres système avancés
   - Variables d'environnement > Path > Modifier
   - Ajouter : `C:\Program Files\Supabase`
5. Redémarrez votre terminal

### Option 3 : Via NPX (sans installation globale)

Utilisez `npx` à chaque commande :

```bash
npx supabase --version
npx supabase init
npx supabase start
```

## Configuration du projet PronoHub

### 1. Initialiser Supabase dans le projet

Dans le dossier du projet :

```bash
cd C:\projets\PronoHub
supabase init
```

Cela crée un dossier `supabase/` avec la structure :

```
supabase/
├── config.toml          # Configuration locale
├── seed.sql             # Données de test
└── migrations/          # Migrations SQL
```

### 2. Lier votre projet Supabase cloud (optionnel)

Si vous voulez synchroniser avec votre projet cloud :

```bash
supabase link --project-ref votre-project-ref
```

Pour obtenir la `project-ref` :
- Allez sur https://supabase.com/dashboard/project/YOUR_PROJECT/settings/general
- Copiez la "Reference ID"

### 3. Démarrer l'instance locale

```bash
supabase start
```

⏳ **Première fois** : Cela prend 2-5 minutes (télécharge les images Docker)

**Services lancés** :
- PostgreSQL : `postgresql://postgres:postgres@localhost:54322/postgres`
- API : http://localhost:54321
- Studio (interface admin) : http://localhost:54323
- Inbucket (emails) : http://localhost:54324
- Auth : http://localhost:54321/auth/v1

### 4. Récupérer les clés locales

Après `supabase start`, vous verrez :

```
API URL: http://localhost:54321
GraphQL URL: http://localhost:54321/graphql/v1
DB URL: postgresql://postgres:postgres@localhost:54322/postgres
Studio URL: http://localhost:54323
Inbucket URL: http://localhost:54324
JWT secret: super-secret-jwt-token-with-at-least-32-characters-long
anon key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
service_role key: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 5. Configurer les variables d'environnement

Créez un fichier `.env.local.development` :

```env
# Supabase Local (pour développement)
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<votre-anon-key-locale>

# API Football (même clé que prod)
FOOTBALL_DATA_API_KEY=<votre-clé>
```

### 6. Appliquer votre schéma de base de données

Si vous avez déjà un schéma SQL :

```bash
# Copier votre schéma actuel dans une migration
supabase db diff --schema public > supabase/migrations/20250104000000_initial_schema.sql

# Appliquer les migrations
supabase db reset
```

Ou importez manuellement via Studio : http://localhost:54323

## Utilisation quotidienne

### Démarrer l'environnement local

```bash
# Dans le dossier PronoHub
supabase start
```

### Lancer l'application

```bash
# Utiliser le fichier .env.local.development
npm run dev
```

### Voir les emails (Inbucket)

Ouvrez http://localhost:54324 dans votre navigateur.

Tous les emails envoyés par Supabase Auth apparaîtront ici !

### Arrêter l'environnement local

```bash
supabase stop
```

### Réinitialiser la base de données

```bash
supabase db reset
```

## Migration des données depuis le cloud

### Exporter votre schéma cloud

```bash
supabase db pull
```

Cela crée une migration avec votre schéma actuel.

### Exporter vos données (seed)

```bash
supabase db dump --data-only > supabase/seed.sql
```

## Tester les emails OTP

### 1. Lancer Supabase local

```bash
supabase start
```

### 2. Ouvrir Inbucket

http://localhost:54324

### 3. Tester l'inscription

1. Allez sur http://localhost:3000/auth/signup
2. Inscrivez-vous avec un email quelconque
3. Rafraîchissez Inbucket
4. Vous verrez l'email avec le code OTP !

### 4. Visualiser le code

Cliquez sur l'email dans Inbucket pour voir :
- Le code OTP à 6 chiffres
- Le contenu HTML/texte de l'email
- Les headers SMTP

## Configuration des templates d'email (local)

### Méthode 1 : Via config.toml

Éditez `supabase/config.toml` :

```toml
[auth.email.template.invite]
subject = "Vous êtes invité à rejoindre {{ .SiteURL }}"
content_path = "./supabase/templates/invite.html"

[auth.email.template.confirmation]
subject = "Confirmez votre inscription sur PronoHub"
content_path = "./supabase/templates/confirmation.html"

[auth.email.template.magic_link]
subject = "Votre code de connexion PronoHub"
content_path = "./supabase/templates/magic_link.html"
```

### Méthode 2 : Via Studio

1. Ouvrez http://localhost:54323
2. Allez dans Authentication > Email Templates
3. Modifiez les templates directement

## Commandes utiles

```bash
# Voir le statut des services
supabase status

# Voir les logs
supabase logs

# Voir les logs d'un service spécifique
supabase logs auth
supabase logs db

# Créer une migration
supabase migration new nom_de_la_migration

# Appliquer les migrations
supabase db push

# Accéder à la base de données
supabase db reset
```

## Passer de local à production

### Variables d'environnement

Utilisez des fichiers différents :

**Développement** (`.env.local.development`) :
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé-locale>
```

**Production** (`.env.local.production`) :
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<clé-cloud>
```

### Scripts npm

Ajoutez dans `package.json` :

```json
{
  "scripts": {
    "dev": "cp .env.local.development .env.local && next dev",
    "dev:prod": "cp .env.local.production .env.local && next dev",
    "build": "cp .env.local.production .env.local && next build"
  }
}
```

### Déploiement des migrations

```bash
# Pousser les migrations vers le cloud
supabase db push --linked
```

## Configuration SMTP en production

Quand vous déployez en production, configurez un vrai SMTP :

### Option 1 : Resend (Recommandé)

1. Créez un compte sur https://resend.com (3000 emails/mois gratuit)
2. Obtenez votre clé API
3. Dans Supabase Dashboard (cloud) :
   - Project Settings > Auth > SMTP Settings
   - Enable Custom SMTP
   - Host : `smtp.resend.com`
   - Port : `587`
   - Username : `resend`
   - Password : `<votre-clé-API>`

### Option 2 : SendGrid

- Host : `smtp.sendgrid.net`
- Port : `587`
- Username : `apikey`
- Password : `<votre-clé-API-sendgrid>`

### Option 3 : Mailgun

- Host : `smtp.mailgun.org`
- Port : `587`
- Username : `<votre-domaine@mailgun.org>`
- Password : `<votre-mot-de-passe-mailgun>`

## Troubleshooting

### Erreur : "Docker is not running"

Supabase CLI nécessite Docker Desktop.

**Solution** :
1. Téléchargez Docker Desktop : https://www.docker.com/products/docker-desktop
2. Installez et lancez Docker Desktop
3. Relancez `supabase start`

### Erreur : "Port already in use"

Un autre service utilise les ports de Supabase.

**Solution** :
```bash
# Voir quel processus utilise le port
netstat -ano | findstr :54321

# Arrêter tous les conteneurs Docker
docker stop $(docker ps -q)

# Relancer Supabase
supabase start
```

### Erreur : "Cannot connect to Docker daemon"

Docker Desktop n'est pas démarré.

**Solution** : Lancez Docker Desktop puis réessayez.

### Les emails n'arrivent pas dans Inbucket

**Vérifications** :
1. Supabase est-il démarré ? `supabase status`
2. Inbucket est-il accessible ? http://localhost:54324
3. Vous utilisez bien les clés locales dans `.env.local` ?

## Avantages vs Inconvénients

### ✅ Avantages

- Développement complètement offline
- Tests illimités gratuits
- Inbucket intégré (pas de config SMTP)
- Réplication exacte de la prod
- Migrations versionnées

### ⚠️ Inconvénients

- Nécessite Docker Desktop (lourd : ~500 Mo)
- Premiers démarrages lents
- Nécessite de gérer 2 environnements (local/cloud)

## Résumé des URLs locales

| Service | URL |
|---------|-----|
| **Application Next.js** | http://localhost:3000 |
| **Supabase API** | http://localhost:54321 |
| **Supabase Studio** | http://localhost:54323 |
| **Inbucket (Emails)** | http://localhost:54324 |
| **PostgreSQL** | postgresql://postgres:postgres@localhost:54322/postgres |

## Workflow recommandé

1. **Matin** : `supabase start` (une seule fois)
2. **Développement** : `npm run dev` (utilise l'env local)
3. **Test emails** : Ouvrir http://localhost:54324
4. **Migrations** : `supabase migration new ...` si changements DB
5. **Soir** : `supabase stop` (libère la RAM)
6. **Avant commit** : `git add supabase/migrations/` (versionnez vos migrations)
7. **Avant déploiement** : `supabase db push --linked` (sync avec prod)

## Prochaine étape

Maintenant que vous avez ce guide, vous devez :

1. **Installer Docker Desktop** : https://www.docker.com/products/docker-desktop
2. **Installer Supabase CLI** (via Scoop ou téléchargement direct)
3. **Exécuter** : `supabase start` dans votre projet

Une fois fait, vous aurez Inbucket fonctionnel à http://localhost:54324 !
