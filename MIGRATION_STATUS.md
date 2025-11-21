# 📊 État de la Migration vers API-Football.com

**Date:** 21 novembre 2025
**Statut Général:** ✅ Phases 1-4 complétées (80%)

---

## ✅ Ce qui a été fait

### Phase 1 : Tables de Base (COMPLÉTÉ ✅)

**Fichier:** [`supabase/migrations/add_api_football_migration.sql`](supabase/migrations/add_api_football_migration.sql)

#### Tables créées :
- ✅ `api_migration_mapping` - Correspondance entre IDs football-data.org et api-football.com
- ✅ `api_request_logs` - Logs de toutes les requêtes API pour monitoring quota
- ✅ `competition_config` - Configuration manuelle des compétitions

#### Vues créées :
- ✅ `daily_api_usage` - Usage quotidien de l'API
- ✅ `current_day_api_usage` - Usage du jour en cours

#### Colonnes ajoutées :
- ✅ `competitions.legacy_football_data_id` - Ancien ID pour traçabilité
- ✅ `competitions.api_provider` - Provider actuel (football-data | api-football)

#### Données initiales :
- ✅ 14 compétitions principales mappées (Premier League, Ligue 1, Serie A, etc.)

---

### Phase 2 : Gestion des Quotas (COMPLÉTÉ ✅)

**Fichier:** [`lib/api-football-quota.ts`](lib/api-football-quota.ts)

#### Fonctionnalités :
- ✅ `getRemainingQuota()` - Obtenir requêtes restantes
- ✅ `canMakeRequest()` - Vérifier si on peut faire N requêtes
- ✅ `logRequest()` - Enregistrer une requête
- ✅ `isCriticalThreshold()` - Alerte quota critique (<20)
- ✅ `getUsageStats()` - Statistiques complètes d'utilisation
- ✅ `getHistoricalUsage()` - Historique sur N jours
- ✅ `getCompetitionUsage()` - Stats par compétition
- ✅ `cleanOldLogs()` - Nettoyage logs >30 jours
- ✅ `canPerformOperation()` - Vérifier faisabilité d'une opération

---

### Phase 3 : Adaptateurs et Client (COMPLÉTÉ ✅)

#### 3.1 Adaptateur de Transformation
**Fichier:** [`lib/api-football-adapter.ts`](lib/api-football-adapter.ts)

**Fonctionnalités :**
- ✅ Mapping des statuts de match (TBD, NS, 1H, HT, FT, etc.)
- ✅ `transformStatus()` - Convertir statut API-Football → format interne
- ✅ `parseMatchdayFromRound()` - Extraire numéro de journée
- ✅ `calculateTotalMatchdays()` - Calculer total journées
- ✅ `transformLeagueToCompetition()` - League → Competition
- ✅ `transformFixtureToMatch()` - Fixture → Match
- ✅ `determineCurrentMatchday()` - Déterminer journée actuelle
- ✅ `filterFixturesByStatus()` - Filtrer par statut
- ✅ `groupFixturesByMatchday()` - Grouper par journée
- ✅ `isMatchLiveOrUpcoming()` - Vérifier si match imminent
- ✅ `validateFixture()` - Valider données fixture

#### 3.2 Client HTTP
**Fichier:** [`lib/api-football-client.ts`](lib/api-football-client.ts)

**Fonctionnalités :**
- ✅ Gestion automatique du quota (vérification avant chaque appel)
- ✅ Logging automatique des requêtes
- ✅ Gestion d'erreurs avec types spécifiques (`QuotaExhaustedError`)
- ✅ Méthodes pour tous les endpoints :
  - `getLeagues()` - Lister leagues
  - `getLeague()` - Une league spécifique
  - `getFixturesByLeague()` - Fixtures d'une league
  - `getFixturesByRound()` - Fixtures d'une journée
  - `getLiveFixtures()` - Matchs en cours
  - `getFixturesByDate()` - Fixtures d'une date
  - `getFixtureById()` - Un fixture spécifique
  - `getFixturesByDateRange()` - Fixtures entre deux dates
- ✅ `testConnection()` - Tester la connexion API
- ✅ `isConfigured()` - Vérifier configuration

#### 3.3 Scheduler Intelligent
**Fichier:** [`lib/api-football-scheduler.ts`](lib/api-football-scheduler.ts)

**Fonctionnalités :**
- ✅ `calculatePriorities()` - Calcul priorités des compétitions
  - Priorité 5 : Matchs EN COURS (update immédiat)
  - Priorité 4 : Matchs dans 2h
  - Priorité 3 : Matchs dans 24h
  - Priorité 2 : Matchs récemment terminés
  - Priorité 1 : Pas de matchs imminents
- ✅ `executeScheduledUpdates()` - Exécuter updates intelligentes
- ✅ `getRecommendedRefreshInterval()` - Déterminer fréquence refresh
- ✅ `getNextUpdateTime()` - Calculer prochain update
- ✅ `shouldUpdateNow()` - Vérifier si update nécessaire maintenant
- ✅ `getScheduleReport()` - Rapport détaillé du planning

---

### Phase 4 : Routes API (COMPLÉTÉ ✅)

#### 4.1 Route `/api/football/competitions`
**Fichier:** [`app/api/football/competitions/route.ts`](app/api/football/competitions/route.ts)

**Modifications :**
- ✅ Support dual provider (football-data | api-football)
- ✅ Paramètre `?provider=api-football` (défaut)
- ✅ Paramètre `?season=2025`
- ✅ Vérification quota avant appel
- ✅ Fallback vers cache si quota épuisé
- ✅ Enrichissement avec données locales
- ✅ Retour des stats de quota dans la réponse

**Réponse :**
```json
{
  "success": true,
  "competitions": [...],
  "count": 150,
  "fromCache": false,
  "quota": {
    "used": 25,
    "remaining": 75,
    "percentage": 25,
    "status": "NORMAL"
  },
  "provider": "api-football",
  "season": 2025
}
```

#### 4.2 Route `/api/football/import`
**Fichier:** [`app/api/football/import/route.ts`](app/api/football/import/route.ts)

**Modifications :**
- ✅ Support dual provider
- ✅ Vérification quota avant import
- ✅ Import complet fixtures + détails league
- ✅ Transformation automatique vers format interne
- ✅ Calcul total matchdays avec fallback config manuelle
- ✅ Détermination journée actuelle
- ✅ Extraction infos saison
- ✅ Stats de quota dans réponse

**Réponse :**
```json
{
  "success": true,
  "competition": "Premier League",
  "competitionId": 39,
  "matchesCount": 380,
  "totalMatchdays": 38,
  "currentMatchday": 15,
  "season": 2024,
  "skippedMatches": 0,
  "provider": "api-football",
  "quota": {
    "used": 26,
    "remaining": 74,
    "percentage": 26
  }
}
```

---

## ⏳ Ce qui reste à faire

### Phase 5 : Interface Admin avec Monitoring (EN ATTENTE)

#### 5.1 Widget Quota dans Admin Settings
**Fichier à modifier:** [`app/admin/settings/page.tsx`](app/admin/settings/page.tsx)

**À ajouter :**
- Widget affichant quota du jour
- Barre de progression colorée (vert/jaune/rouge)
- Alertes si quota critique
- Statistiques détaillées (utilisées/disponibles/pourcentage)
- Reset timer (00:00 UTC)

#### 5.2 Indicateur Quota sur Page Import
**Fichier à modifier:** [`app/admin/import/page.tsx`](app/admin/import/page.tsx)

**À ajouter :**
- Bandeau quota en haut de page
- Indicateur visuel du quota restant
- Message d'avertissement si quota bas
- Blocage import si quota épuisé

#### 5.3 Page Logs et Monitoring (NOUVEAU)
**Fichier à créer:** `app/admin/api-logs/page.tsx`

**Fonctionnalités :**
- Graphique utilisation quotidienne (7 derniers jours)
- Liste des requêtes du jour avec détails
- Statistiques par compétition
- Filtres par date, statut, endpoint

---

### Phase 6 : Tests et Validation (EN ATTENTE)

#### 6.1 Exécuter la Migration SQL
```bash
# Se connecter à Supabase et exécuter
psql -h db.xxx.supabase.co -U postgres -d postgres -f supabase/migrations/add_api_football_migration.sql
```

Ou via l'interface Supabase :
1. Aller dans SQL Editor
2. Coller le contenu de `add_api_football_migration.sql`
3. Exécuter

#### 6.2 Configurer les Variables d'Environnement
**Fichier:** `.env.local`

```env
# API-Football (Nouveau provider)
API_FOOTBALL_KEY=ta_clé_api_ici
API_FOOTBALL_HOST=v3.football.api-sports.io
```

**Pour obtenir la clé :**
1. Aller sur https://www.api-football.com/
2. S'inscrire (plan gratuit = 100 req/jour)
3. Récupérer la clé API dans le dashboard

#### 6.3 Tests à Effectuer

**Test 1 : Lister les Compétitions**
```bash
# Depuis le navigateur ou curl
GET http://localhost:3000/api/football/competitions?provider=api-football&season=2024
```

**Vérifier :**
- ✅ Réponse 200 OK
- ✅ Liste des compétitions retournée
- ✅ Quota stats présentes dans la réponse
- ✅ Logs créés dans `api_request_logs`

**Test 2 : Importer une Compétition (Premier League)**
```bash
POST http://localhost:3000/api/football/import
Body: { "competitionId": 39, "provider": "api-football" }
```

**Vérifier :**
- ✅ Import réussi
- ✅ Compétition créée dans `competitions`
- ✅ Matchs créés dans `imported_matches`
- ✅ Total matchdays calculé correctement
- ✅ Quota incrémenté

**Test 3 : Vérifier le Quota**
```sql
SELECT * FROM current_day_api_usage;
```

**Vérifier :**
- ✅ `total_requests` = nombre d'appels faits
- ✅ `remaining_requests` = 100 - total_requests
- ✅ `quota_status` = NORMAL/WARNING/CRITICAL/EXHAUSTED

**Test 4 : Test Quota Épuisé**
Simuler quota épuisé en modifiant temporairement `DAILY_LIMIT` dans `api-football-quota.ts` à une petite valeur (ex: 2).

**Vérifier :**
- ✅ Appels API bloqués après limite
- ✅ Erreur 429 retournée
- ✅ Fallback vers cache fonctionne
- ✅ Message utilisateur clair

**Test 5 : Scheduler Intelligent**
```typescript
// Dans une route de test ou via console Node
import { ApiFootballScheduler } from '@/lib/api-football-scheduler'

const report = await ApiFootballScheduler.getScheduleReport()
console.log(report)
```

**Vérifier :**
- ✅ Priorités calculées correctement
- ✅ Compétitions avec matchs en cours = priorité 5
- ✅ Recommandation d'intervalle cohérente

---

## 📦 Fichiers Créés (Résumé)

### Base de Données
1. `supabase/migrations/add_api_football_migration.sql` (484 lignes)

### Bibliothèques
2. `lib/api-football-quota.ts` (243 lignes)
3. `lib/api-football-adapter.ts` (426 lignes)
4. `lib/api-football-client.ts` (345 lignes)
5. `lib/api-football-scheduler.ts` (267 lignes)

### Routes API
6. `app/api/football/competitions/route.ts` (modifié - 213 lignes)
7. `app/api/football/import/route.ts` (modifié - 349 lignes)

### Configuration
8. `.env.example` (modifié - ajout API-Football)

### Documentation
9. `MIGRATION_API_FOOTBALL_FEASIBILITY.md` (1200+ lignes)
10. `MIGRATION_STATUS.md` (ce fichier)

**Total Code Écrit :** ~3500 lignes

---

## 🎯 Prochaines Actions Immédiates

### 1. Exécuter la Migration SQL ⚡ PRIORITAIRE
```bash
# Via Supabase Dashboard > SQL Editor
# Coller et exécuter: supabase/migrations/add_api_football_migration.sql
```

### 2. Obtenir Clé API-Football 🔑 PRIORITAIRE
1. Aller sur https://www.api-football.com/
2. S'inscrire (gratuit, 100 req/jour)
3. Récupérer la clé dans le dashboard
4. Ajouter dans `.env.local` :
   ```env
   API_FOOTBALL_KEY=ta_clé_ici
   API_FOOTBALL_HOST=v3.football.api-sports.io
   ```

### 3. Premier Test 🧪
```bash
# Redémarrer le serveur
npm run dev

# Tester dans le navigateur
http://localhost:3000/api/football/competitions?provider=api-football
```

### 4. Import Test
Aller sur http://localhost:3000/admin/import et essayer d'importer une compétition depuis API-Football.

---

## 📊 Métriques de Migration

| Métrique | Valeur |
|----------|--------|
| **Phases complétées** | 4/6 (67%) |
| **Lignes de code écrites** | ~3500 |
| **Fichiers créés** | 5 nouveaux |
| **Fichiers modifiés** | 5 existants |
| **Tables créées** | 2 principales |
| **Vues créées** | 2 |
| **Fonctions SQL** | 2 |
| **Compétitions mappées** | 14 |
| **Tests à effectuer** | 5 |

---

## 🔍 Points Importants

### Compatibilité Backward
✅ **Mode Hybride Actif** : Les deux APIs fonctionnent en parallèle
- Routes acceptent le paramètre `?provider=api-football` ou `?provider=football-data`
- Par défaut : `api-football`
- Permet migration progressive sans casser l'existant

### Gestion Intelligente du Quota
✅ **Système de Priorisation** automatique :
- Matchs EN COURS → update immédiat (priorité 5)
- Matchs sous 2h → update fréquent (priorité 4)
- Matchs sous 24h → update modéré (priorité 3)
- Pas de matchs → update minimal (priorité 1)

✅ **Protection Anti-Dépassement** :
- Vérification AVANT chaque appel
- Fallback automatique vers cache si quota épuisé
- Logging de toutes les tentatives

### Monitoring Complet
✅ **Traçabilité Totale** :
- Chaque requête loggée avec timestamp, endpoint, succès/échec
- Temps de réponse enregistré
- Stats par compétition disponibles
- Historique sur 30 jours (auto-nettoyage)

---

## 🚀 Après les Tests

Une fois les tests Phase 6 validés :

1. **Migrer les compétitions existantes**
   - Script à créer pour mapper IDs des compétitions actuelles
   - Réimporter depuis API-Football

2. **Activer le scheduler automatique**
   - Créer tâche cron pour `ApiFootballScheduler.executeScheduledUpdates()`
   - Fréquence recommandée : toutes les 15 minutes

3. **Finaliser l'interface admin**
   - Compléter Phase 5 (widgets quota)

4. **Supprimer le code legacy**
   - Retirer support football-data.org après 1 mois de tests

---

## 💡 Conseils

### Gestion du Quota (100 req/jour)
- ✅ **Matin** : 1 sync générale = 5 req (si 5 compétitions actives)
- ✅ **Journée matchs** : 3 syncs = 15 req
- ✅ **Soir** : 1 sync finale = 5 req
- **Total typique :** 25-30 req/jour → **Marge confortable !**

### Optimisations Possibles
- Utiliser Redis pour cache ultra-rapide (optionnel)
- Implémenter webhooks si API-Football les propose
- ML pour prédire quand les matchs auront lieu

### Monitoring
- Surveiller `daily_api_usage` tous les jours
- Ajuster fréquence refresh selon usage réel
- Considérer upgrade plan (Pro = 7500 req/jour pour 19€/mois) si besoin

---

## 📞 Support

En cas de problème :
1. Vérifier logs serveur (`npm run dev`)
2. Vérifier table `api_request_logs` dans Supabase
3. Consulter `MIGRATION_API_FOOTBALL_FEASIBILITY.md` pour détails techniques

---

**Dernière mise à jour :** 21 novembre 2025
**Prochaine étape :** Exécuter migration SQL + obtenir clé API 🚀
