# Installation en cours - Supabase CLI + Docker

## Contexte

Installation de l'environnement de développement local pour tester les emails d'inscription.

## Étapes terminées ✅

1. ✅ Récupération de la dernière version du projet via `git pull`
2. ✅ Lecture des consignes (README, WORKFLOW, RESUME_SESSION)
3. ✅ Création de la documentation :
   - `docs/INBUCKET-SETUP.md` (guide Inbucket standalone)
   - `docs/SUPABASE-LOCAL-SETUP.md` (guide Supabase CLI)
   - `docs/SETUP-2-PC.md` (workflow pour 2 PC)

## Étape en cours 🔄

**Installation de Docker Desktop**

- Docker n'était pas installé sur ce PC
- Téléchargement depuis : https://www.docker.com/products/docker-desktop
- Après installation, un redémarrage Windows est nécessaire

## Prochaines étapes (après redémarrage)

### 1. Vérifier que Docker fonctionne

Ouvrir un terminal et taper :
```bash
docker --version
```

Vous devriez voir : `Docker version 24.x.x, build xxxxx`

### 2. Vérifier si Scoop est installé

```bash
scoop --version
```

Si pas installé, on installera Scoop.

### 3. Installer Supabase CLI via Scoop

```bash
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase
```

### 4. Initialiser Supabase dans le projet

```bash
cd C:\projets\PronoHub
supabase init
```

### 5. Démarrer Supabase

```bash
supabase start
```

Cela va télécharger les images Docker (première fois = 2-5 minutes).

### 6. Récupérer les clés locales

Après `supabase start`, copier les clés affichées :
- `API URL`
- `anon key`

### 7. Configurer .env.local

Créer/modifier `.env.local` avec :
```env
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-copiée>
FOOTBALL_DATA_API_KEY=<votre-clé-existante>
```

### 8. Tester Inbucket

- Ouvrir http://localhost:54324
- Lancer l'app : `npm run dev`
- Tester une inscription sur http://localhost:3000/auth/signup
- Vérifier que l'email arrive dans Inbucket

## Message à envoyer après redémarrage

Après le redémarrage Windows, vous pouvez simplement dire :

> "Je reviens, Docker est installé. Continuons !"

Et je reprendrai exactement où on s'est arrêté.

## Fichiers créés pendant cette session

- `docs/INBUCKET-SETUP.md`
- `docs/SUPABASE-LOCAL-SETUP.md`
- `docs/SETUP-2-PC.md`
- `INSTALLATION-EN-COURS.md` (ce fichier)

## À faire sur le 2ème PC (plus tard)

Une fois que tout fonctionne sur ce PC, répéter les mêmes étapes sur votre 2ème PC :
1. Installer Docker Desktop
2. Installer Scoop
3. Installer Supabase CLI
4. `git pull` pour récupérer le dossier `supabase/`
5. `supabase start`

Le guide complet est dans `docs/SETUP-2-PC.md`.

---

**Date** : 04/11/2025
**Statut** : En attente de redémarrage Windows après installation Docker Desktop
