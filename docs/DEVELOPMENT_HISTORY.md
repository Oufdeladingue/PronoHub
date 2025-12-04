# Historique de développement PronoHub

## Vue d'ensemble du projet

**PronoHub** est une application web de pronostics sportifs permettant aux utilisateurs de créer et participer à des tournois de prédictions sur différentes compétitions de football.

### Stack technique
- **Frontend**: Next.js 16.0.1 avec Turbopack
- **Styling**: Tailwind CSS v4 (`@import "tailwindcss"`)
- **Backend**: Supabase PostgreSQL avec Row Level Security (RLS)
- **Langage**: TypeScript
- **Authentification**: Supabase Auth
- **APIs externes**: Football-Data.org

---

## Architecture de la base de données

### Tables principales

#### `tournaments`
- `id` (UUID, PK)
- `name` (VARCHAR 255) - Nom du tournoi
- `slug` (VARCHAR 8, UNIQUE) - Code court du tournoi (ex: UBPBZYHL)
- `competition_id` (INTEGER) - ID de la compétition support
- `competition_name` (VARCHAR 255)
- `max_players` (INTEGER, default 10)
- `max_participants` (INTEGER) - Compatibilité ancienne structure
- `num_matchdays` (INTEGER) - Nombre de journées
- `matchdays_count` (INTEGER) - Compatibilité
- `all_matchdays` (BOOLEAN) - Toutes les journées ou sélection
- `bonus_match_enabled` (BOOLEAN)
- `creator_id` (UUID, FK → profiles.id)
- `status` (VARCHAR) - 'pending', 'active', 'completed'
- `current_participants` (INTEGER)
- `scoring_exact_score` (INTEGER, default 3)
- `scoring_correct_winner` (INTEGER, default 1)
- `scoring_correct_goal_difference` (INTEGER, default 2)
- `created_at` (TIMESTAMP)

#### `tournament_participants`
- `id` (UUID, PK)
- `tournament_id` (UUID, FK → tournaments.id)
- `user_id` (UUID, FK → profiles.id)
- `joined_at` (TIMESTAMP)

#### `profiles`
- `id` (UUID, PK, FK → auth.users.id)
- `username` (VARCHAR)
- Autres champs profil utilisateur

#### `competitions`
- `id` (INTEGER, PK)
- `name` (VARCHAR)
- `emblem` (TEXT) - URL du logo de la compétition

#### `imported_matches`
- `id` (INTEGER, PK)
- `competition_id` (INTEGER, FK → competitions.id)
- `matchday` (INTEGER)
- `utc_date` (TIMESTAMP)
- Autres données de match

#### `admin_settings`
- `setting_key` (VARCHAR, PK)
- `setting_value` (TEXT)

**Paramètres configurés:**
- `free_tier_max_players`: "8" - Limite de joueurs pour compte gratuit
- `points_exact_score`: "3" - Points pour score exact
- `points_correct_result`: "1" - Points pour bon résultat

---

## Fonctionnalités implémentées

### 1. Page échauffement (`/vestiaire/[tournamentSlug]/echauffement`)
**Fichier**: `app/vestiaire/[tournamentSlug]/echauffement/page.tsx`

#### Fonctionnalités principales

**Pour tous les participants:**
- Vue en temps réel des joueurs inscrits (refresh toutes les 5s)
- Affichage du logo de la compétition (64x64px)
- Code d'invitation avec copie rapide
- Partage du lien d'invitation
- Timer compte à rebours en temps réel vers la prochaine journée
  - Format: jours/heures/minutes/secondes
  - Mise à jour chaque seconde
  - Calcul dynamique basé sur les matchs à venir
- Indicateur de phase "ÉCHAUFFEMENT"

**Contrôles du capitaine (créateur uniquement):**
1. **Gestion des places:**
   - Ajouter des places (limité à `free_tier_max_players` = 8)
   - Supprimer des places vacantes (minimum 2 places)
   - Protection: impossible de supprimer une place occupée
   - Boutons visibles sous la liste des joueurs

2. **Actions du tournoi:**
   - Démarrer le tournoi (minimum 2 participants)
   - Transférer le capitanat à un autre participant
   - Quitter le tournoi (nécessite transfert si pas seul)
   - Annuler le tournoi (si seul participant)

3. **Visuels spéciaux:**
   - Badge "⭐ Capitaine" pour le créateur
   - Section "Contrôles du Capitaine" avec fond jaune/orange
   - Boutons "Transférer" à côté des autres participants

#### Code important - Timer en temps réel

```typescript
// State pour le timer
const [nextMatchDate, setNextMatchDate] = useState<Date | null>(null)
const [timeRemaining, setTimeRemaining] = useState<{
  days: number,
  hours: number,
  minutes: number,
  seconds: number
} | null>(null)

// Récupération de la prochaine date de match
const fetchNextMatchDate = async () => {
  const response = await fetch(`/api/football/competition-matches?competitionId=${tournament.competition_id}`)
  const data = await response.json()

  const now = new Date()
  const upcomingMatches = data.matches
    .filter((match: any) => new Date(match.utc_date) > now)
    .sort((a: any, b: any) => new Date(a.utc_date).getTime() - new Date(b.utc_date).getTime())

  if (upcomingMatches.length > 0) {
    setNextMatchDate(new Date(upcomingMatches[0].utc_date))
  }
}

// Mise à jour du timer chaque seconde
useEffect(() => {
  if (!nextMatchDate) return

  const updateTimer = () => {
    const now = new Date()
    const diff = nextMatchDate.getTime() - now.getTime()

    if (diff <= 0) {
      setTimeRemaining({ days: 0, hours: 0, minutes: 0, seconds: 0 })
      return
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)

    setTimeRemaining({ days, hours, minutes, seconds })
  }

  updateTimer()
  const interval = setInterval(updateTimer, 1000)
  return () => clearInterval(interval)
}, [nextMatchDate])
```

#### Code important - Gestion des places

```typescript
const handleIncreaseMaxPlayers = async () => {
  if (!tournament || tournament.max_players >= maxParticipantsLimit) {
    alert(`Limite maximale de ${maxParticipantsLimit} participants atteinte pour un compte gratuit`)
    return
  }

  const supabase = createClient()
  await supabase
    .from('tournaments')
    .update({
      max_players: tournament.max_players + 1,
      max_participants: tournament.max_players + 1
    })
    .eq('id', tournament.id)
}

const handleDecreaseMaxPlayers = async () => {
  if (tournament.max_players <= 2) {
    alert('Un tournoi comporte au minimum deux places')
    return
  }

  if (tournament.max_players <= players.length) {
    alert('Impossible de supprimer une place déjà occupée par un joueur')
    return
  }

  const supabase = createClient()
  await supabase
    .from('tournaments')
    .update({
      max_players: tournament.max_players - 1,
      max_participants: tournament.max_players - 1
    })
    .eq('id', tournament.id)
}
```

### 2. Création de tournoi avec vérification profil
**Fichier**: `app/api/tournaments/create/route.ts`

**Problème résolu**: Le créateur n'était pas ajouté comme participant car la foreign key `user_id → profiles.id` échouait si l'utilisateur n'avait pas de profil.

**Solution implémentée:**
```typescript
// Vérifier si l'utilisateur a un profil
const { data: profile } = await supabase
  .from('profiles')
  .select('id')
  .eq('id', user.id)
  .single()

if (!profile) {
  console.error('User has no profile, skipping participant insertion')
  return NextResponse.json({
    success: true,
    tournament,
    warning: 'Tournoi créé mais profil utilisateur manquant'
  })
}

// Ajouter le créateur comme premier participant
const { error: playerError } = await supabase
  .from('tournament_participants')
  .insert({
    tournament_id: tournament.id,
    user_id: user.id
  })
```

---

## APIs disponibles

### `/api/tournaments/create` (POST)
Crée un nouveau tournoi et ajoute le créateur comme premier participant.

**Body:**
```json
{
  "name": "string",
  "slug": "string (8 chars)",
  "competitionId": "number",
  "competitionName": "string",
  "maxPlayers": "number",
  "numMatchdays": "number",
  "allMatchdays": "boolean",
  "bonusMatchEnabled": "boolean"
}
```

### `/api/settings/public` (GET)
Retourne les paramètres publics non sensibles.

**Response:**
```json
{
  "success": true,
  "settings": {
    "free_tier_max_players": "8",
    "points_exact_score": "3",
    "points_correct_result": "1"
  }
}
```

### `/api/football/competition-matches` (GET)
Récupère tous les matchs d'une compétition.

**Query params:**
- `competitionId`: ID de la compétition

**Response:**
```json
{
  "competition": { /* données compétition */ },
  "matches": [ /* array de matchs */ ],
  "matchesByMatchday": { /* matchs groupés par journée */ },
  "totalMatches": "number",
  "matchdays": [ /* array de numéros de journées */ ]
}
```

### `/api/tournaments/fix-participants` (GET)
API de diagnostic pour vérifier et corriger les participants.

**Query params:**
- `slug`: Slug du tournoi

---

## Scripts PowerShell

### `run_dev.ps1`
Lance le serveur de développement avec les variables d'environnement Supabase.

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://txpmihreaxmtsxlgmdko.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "eyJ..."
npm run dev
```

### Scripts de synchronisation Python
- `fetch_cl_to_sheets.py` - Synchronisation vers Google Sheets
- Scripts avec `_with_env.ps1` pour l'exécution avec variables d'environnement

---

## Décisions techniques importantes

### 1. Slug vs Code tournoi
- **Slug complet**: `nomtournoi_ABCDEFGH` (utilisé dans l'URL)
- **Code tournoi**: `ABCDEFGH` (8 caractères, affiché à l'utilisateur)
- Extraction: `tournamentSlug.split('_').pop()?.toUpperCase()`

### 2. Compatibilité champs
Plusieurs champs en double pour compatibilité:
- `max_players` ↔ `max_participants`
- `num_matchdays` ↔ `matchdays_count`
- `slug` ↔ `invite_code`

### 3. Mise à jour en temps réel
- **Joueurs**: Refresh toutes les 5 secondes avec `setInterval`
- **Timer**: Mise à jour chaque seconde
- Pas de WebSocket pour le moment

### 4. Gestion des erreurs
- Validation côté client (alerts) avant requêtes DB
- Logs console pour debugging
- Messages d'erreur en français pour l'utilisateur

### 5. Tailwind CSS v4
Nouvelle syntaxe d'import dans `app/globals.css`:
```css
@import "tailwindcss";
```

---

## Problèmes résolus

### Problème 1: Créateur non ajouté comme participant
**Symptôme**: Le créateur n'apparaissait pas dans la liste des participants.
**Cause**: Foreign key `user_id → profiles.id` échouait si pas de profil.
**Solution**: Vérification du profil avant insertion + gestion du warning.

### Problème 2: Mauvais champ settings
**Symptôme**: Limite affichée à 10 au lieu de 8.
**Cause**: Code cherchait `max_participants_free` au lieu de `free_tier_max_players`.
**Solution**: Correction du nom de champ + `parseInt()` pour conversion string→number.

### Problème 3: UI confuse pour gestion places
**Symptôme**: Boutons de gestion mal placés.
**Solution**: Déplacement des boutons sous la liste des joueurs, dans le même container.

### Problème 4: Texte bouton trop long
**Symptôme**: "Supprimer une place vacante (minimum 2 places)" trop verbeux.
**Solution**: Simplifié en "Supprimer une place", validation gérée par alert.

---

## Structure des URLs

### Pages publiques
- `/` - Page d'accueil
- `/vestiaire` - Liste des tournois de l'utilisateur
- `/vestiaire/rejoindre?code=ABCDEFGH` - Rejoindre un tournoi

### Pages tournoi
- `/vestiaire/[tournamentSlug]/echauffement` - Phase d'attente/inscription
- `/vestiaire/[tournamentSlug]/actif` - Tournoi en cours (TODO)

### Pages admin
- `/admin/import` - Import de compétitions
- `/admin/settings` - Paramètres globaux

---

## TODO et améliorations futures

### Priorités
1. **Page tournoi actif** - Affichage des matchs et saisie des pronostics
2. **Redirection après démarrage** - Actuellement juste une alert
3. **WebSocket** - Remplacer les setInterval par du temps réel
4. **Notifications** - Alerter les joueurs du début du tournoi

### Améliorations UX
- Confirmation modale au lieu d'alerts navigateur
- Loading states sur les boutons d'action
- Animation lors de l'ajout/suppression de places
- Toast notifications au lieu d'alerts

### Performance
- Cache des logos de compétitions
- Optimisation des requêtes DB
- Pagination si beaucoup de tournois

### Sécurité
- Rate limiting sur les APIs
- Validation plus stricte des inputs
- RLS policies à vérifier/renforcer

---

## Configuration pour un nouveau PC

### 1. Cloner le projet
```bash
git clone https://github.com/Oufdeladingue/PronoHub.git
cd PronoHub
npm install
```

### 2. Variables d'environnement
Créer `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=<votre_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<votre_anon_key>
```

### 3. Lancer le dev server
```bash
npm run dev
# Ou utiliser run_dev.ps1 sur Windows
```

### 4. Accès Supabase
- **URL projet**: https://supabase.com/dashboard/project/txpmihreaxmtsxlgmdko
- Les credentials sont dans le fichier `service-account.json` (NE PAS COMMITER)

---

## Contacts et ressources

### Repo GitHub
https://github.com/Oufdeladingue/PronoHub

### Documentation Next.js 16
https://nextjs.org/docs

### Documentation Supabase
https://supabase.com/docs

### Documentation Tailwind CSS v4
https://tailwindcss.com/docs/v4-beta

---

**Dernière mise à jour**: Session du 3 novembre 2025
**Commit associé**: feat: Page échauffement - Ajout contrôles capitaine, timer journée, et logo compétition
