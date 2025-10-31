# PronoHub

Application web de tournois de pronostics sportifs (football).

## Fonctionnalités

- Création de compte utilisateur
- Création de tournois basés sur des compétitions réelles (Ligue 1, Champions League, etc.)
- Génération de codes d'invitation et QR codes
- Pronostics sur les scores des matchs
- Calcul automatique des points et classements
- Maximum 8 participants par tournoi (version gratuite)

## Stack Technique

- **Frontend**: Next.js 14 (App Router), TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Base de données**: Supabase (PostgreSQL)
- **Authentification**: Supabase Auth
- **API externe**: football-data.org

## Installation

1. Cloner le repository
```bash
git clone <url-du-repo>
cd PronoHub
```

2. Installer les dépendances
```bash
npm install
```

3. Configurer les variables d'environnement
```bash
cp .env.example .env.local
```
Puis remplir les valeurs dans `.env.local`

4. Lancer le serveur de développement
```bash
npm run dev
```

5. Ouvrir [http://localhost:3000](http://localhost:3000)

## Structure du Projet

```
PronoHub/
├── app/                    # Pages et routes Next.js
│   ├── api/               # API Routes
│   ├── auth/              # Pages d'authentification
│   ├── tournaments/       # Pages des tournois
│   └── dashboard/         # Tableau de bord utilisateur
├── components/            # Composants React réutilisables
├── lib/                   # Utilitaires et configuration
├── types/                 # Types TypeScript
├── utils/                 # Fonctions utilitaires
└── public/               # Assets statiques
```

## Configuration Supabase

À venir...

## Configuration Football-Data API

1. Créer un compte sur [football-data.org](https://www.football-data.org/)
2. Obtenir une clé API (tier gratuit disponible)
3. Ajouter la clé dans `.env.local`

## Développement

```bash
npm run dev      # Lancer en mode développement
npm run build    # Build de production
npm start        # Lancer en production
npm run lint     # Linter le code
```

## Licence

MIT
