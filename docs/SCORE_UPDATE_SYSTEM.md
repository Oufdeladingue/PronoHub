# Systeme de mise a jour des scores - PronoHub

## Vue d'ensemble

PronoHub utilise un systeme multi-sources pour maintenir les scores des matchs a jour. L'API principale (football-data.org, tier gratuit) a des limitations qui necessitent des sources de fallback pour garantir des scores fiables en temps reel.

```
                    pg_cron (Supabase)
                         |
            +------------+------------+
            |                         |
    Auto-Update (quotidien)    Realtime-Update (temps reel)
    /api/football/auto-update  /api/football/realtime-update
            |                         |
            v                         v
    +-------+-------+        +-------+-------+
    | football-data |        | football-data |
    | (source #1)   |        | (source #1)   |
    +-------+-------+        +-------+-------+
            |                         |
            | si stale                | si stale
            v                         v
    +-------+-------+        +-------+-------+
    | native-stats  |        | native-stats  |
    | (source #2)   |        | (source #2)   |
    +-------+-------+        +-------+-------+
            |
            | cooldown 4h
            v
    +-------+-------+
    | TheSportsDB   |
    | (source #3)   |
    +-------+-------+
```

---

## Sources de donnees

### Source #1 : football-data.org (API principale)

| Propriete | Valeur |
|-----------|--------|
| **URL** | `https://api.football-data.org/v4` |
| **Authentification** | Cle API via header `X-Auth-Token` |
| **Tier** | Gratuit |
| **Rate limit** | 10 appels/minute |
| **Competitions** | Ligue 1, La Liga, Bundesliga, Serie A, Premier League, Champions League, Europa League |

**Limitations du tier gratuit :**
- Les scores ne sont pas toujours mis a jour en temps reel
- Certains matchs restent en statut `TIMED` (planifie) alors qu'ils sont en cours ou termines
- Delai variable selon la competition (quelques minutes a plusieurs heures)

**Utilisation :**
- **Auto-update** : Recupere tous les matchs de chaque competition active (2 appels API par competition)
- **Realtime-update** : Recupere match par match ou par competition selon le nombre de matchs actifs

### Source #2 : native-stats.org (Fallback temps reel)

| Propriete | Valeur |
|-----------|--------|
| **URL** | `https://native-stats.org/match/{matchId}` |
| **Authentification** | Aucune (scraping HTML) |
| **Rate limit** | Aucun (delai de courtoisie 500ms entre requetes) |
| **Avantage cle** | Utilise les **memes IDs de matchs** que football-data.org |

**Fonctionnement :**
1. Scrape la page HTML du match via son `football_data_match_id`
2. Extrait le score depuis `<div id="score">`
3. Parse la table des buts pour detecter les prolongations
4. Si prolongation : retourne le score a l'issue des 90 minutes reglementaires (pas le score prolongation)
5. Determine si le match est termine : `Date.now() > kickoff + 2h15`

**Declenchement :**
- Active quand football-data.org retourne des donnees "stale" (statut `TIMED` alors que le kickoff est depasse)
- Pas de cooldown, s'execute a chaque run d'auto-update

**Code :** [lib/native-stats-scraper.ts](../lib/native-stats-scraper.ts)

### Source #3 : TheSportsDB (Fallback avec cooldown)

| Propriete | Valeur |
|-----------|--------|
| **URL** | `https://www.thesportsdb.com/api/v1/json/123` |
| **Authentification** | Aucune (cle par defaut `123`) |
| **Rate limit** | 30 requetes/minute |
| **Cooldown** | 4 heures entre chaque execution |
| **Max appels/run** | 20 |

**Fonctionnement :**
1. Cherche les matchs `TIMED`/`SCHEDULED` dont le kickoff est depasse depuis > 3h (et < 2 semaines)
2. Groupe les matchs par (competition, matchday)
3. Fait un appel API par groupe via l'endpoint `eventsround.php`
4. Matche les equipes par **fuzzy matching** des noms (pas de correspondance d'ID)
5. Met a jour les matchs trouves avec `status: FINISHED`

**Limitations :**
- Matching par nom d'equipe (peut echouer si noms tres differents)
- Mapping manuel des competition IDs entre football-data.org et TheSportsDB
- Cooldown de 4h pour eviter les requetes inutiles

**Code :** [lib/api-football-fallback.ts](../lib/api-football-fallback.ts)

---

## Les deux pipelines de mise a jour

### 1. Auto-Update (mise a jour globale)

**Route :** `POST /api/football/auto-update`
**Code :** [app/api/football/auto-update/route.ts](../app/api/football/auto-update/route.ts)
**Declenchement :** pg_cron (configurable, typiquement toutes les 1-2h) ou manuellement depuis l'admin

**Etapes :**

```
1. Recuperer les competitions actives (is_active = true, saison non terminee)
2. Pour chaque competition (avec 12s de delai entre chaque) :
   a. Fetch les details de la competition
   b. Fetch tous les matchs de la competition
   c. Filtrer les matchs stale (protection)
   d. Upsert les matchs dans imported_matches
3. Verifier et terminer les tournois completes
4. Fallback native-stats : patcher les matchs stale
5. Fallback TheSportsDB : patcher les matchs stale (cooldown 4h)
```

**Protections anti-corruption des donnees :**

| Protection | Description |
|------------|-------------|
| **Skip TIMED stale** | Ignore les matchs `TIMED`/`SCHEDULED` dont le kickoff est depasse > 3h (football-data retourne du stale) |
| **Skip IN_PLAY stale** | Ignore les matchs `IN_PLAY`/`PAUSED` dont le kickoff est depasse > 5h (aucun match ne dure si longtemps) |
| **Protection FINISHED** | Un match deja `FINISHED` en DB n'est jamais retrograde vers un statut inferieur (`TIMED`, `IN_PLAY`). Les scores existants sont conserves |

### 2. Realtime-Update (mise a jour ciblee)

**Route :** `POST /api/football/realtime-update`
**Code :** [app/api/football/realtime-update/route.ts](../app/api/football/realtime-update/route.ts)
**Declenchement :** pg_cron a haute frequence (toutes les 2-5 min) quand des matchs sont en cours

**Prerequis :** Les **fenetres de matchs** (`match_windows`) doivent etre generees. Chaque fenetre definit une plage horaire pendant laquelle le realtime-update est actif pour une competition donnee.

**Strategie hybride (optimisation des appels API) :**

| Condition | Strategie | Appels API |
|-----------|-----------|-----------|
| < 5 matchs actifs dans la competition | **Individuelle** : un appel par match (`/matches/{id}`) | N appels |
| >= 5 matchs actifs dans la competition | **Competition** : un appel pour toute la competition (`/competitions/{id}/matches`) | 1 appel |

**Etapes :**
```
1. Recuperer les fenetres de matchs actives (match_windows)
2. Pour chaque fenetre, recuperer les matchs concernes
3. Filtrer les matchs proches du kickoff (10min avant a 3h apres)
4. Choisir la strategie (individuelle ou competition)
5. Fetch les donnees et mettre a jour
6. Si football-data stale → fallback native-stats.org
```

---

## Hierarchie des priorites (par match)

Quand un match est mis a jour, le systeme applique cette logique :

```
1. Le match est-il deja FINISHED en DB ?
   → OUI : ne pas ecraser (sauf si football-data confirme aussi FINISHED)
   → NON : continuer

2. Football-data.org retourne-t-il des donnees fraiches ?
   (status != TIMED quand kickoff depasse)
   → OUI : utiliser les donnees football-data
   → NON (stale) : continuer

3. native-stats.org a-t-il un score ?
   → OUI : utiliser le score native-stats
   → NON : ne pas mettre a jour ce match

4. (Auto-update seulement) TheSportsDB a-t-il un score ?
   (avec cooldown 4h, matchs > 3h apres kickoff)
   → OUI : utiliser le score TheSportsDB
   → NON : le match reste en l'etat
```

---

## Detection des matchs stale

Un match est considere "stale" quand l'API retourne un statut qui ne correspond plus a la realite :

| Situation | Detection | Action |
|-----------|-----------|--------|
| `TIMED` alors que kickoff depasse | `utc_date < now - 15min` | Fallback native-stats |
| `TIMED` alors que kickoff depasse > 3h | `utc_date < now - 3h` | Skip dans auto-update + fallback TheSportsDB |
| `IN_PLAY` alors que kickoff depasse > 3h | `utc_date < now - 3h` | Fallback native-stats (devrait etre FINISHED) |
| `IN_PLAY` alors que kickoff depasse > 5h | `utc_date < now - 5h` | Skip dans auto-update (donnee corrompue) |

---

## Fenetres de matchs (match_windows)

Les fenetres de matchs sont generees via la fonction SQL `generate_match_windows()` et stockees dans la table `match_windows`.

Chaque fenetre a :
- `competition_id` : la competition concernee
- `match_date` : la date des matchs
- `window_start` : debut de la fenetre (premier kickoff - marge avant)
- `window_end` : fin de la fenetre (dernier kickoff + 90min + marge apres)

**Parametres configurables dans l'admin :**
- **Marge avant kickoff** : par defaut 5 min (recommande : 5-10 min)
- **Marge apres 90 min** : par defaut 30 min (recommande : 90 min pour couvrir prolongations + retards)

> **Important :** Si la marge apres 90 min est trop courte, le realtime-update s'arrete avant la fin des matchs. Le fallback native-stats dans l'auto-update couvre ce cas, mais avec moins de reactivite.

---

## Configuration pg_cron (Supabase)

Le systeme utilise pg_cron de Supabase pour declencher automatiquement les mises a jour. La configuration se fait via l'interface admin (Smart Cron).

**Deux jobs pg_cron :**

| Job | Fonction | Frequence typique |
|-----|----------|-------------------|
| `daily-sync` | Appelle `POST /api/football/auto-update` | Toutes les heures a toutes les 6h |
| `realtime-update` | Appelle `POST /api/football/realtime-update` | Toutes les 2-5 min (quand fenetres actives) |

**Route admin :** `GET/POST /api/admin/smart-cron`
**Code :** [app/api/admin/smart-cron/route.ts](../app/api/admin/smart-cron/route.ts)

---

## Logging et monitoring

### Table `cron_logs`

Chaque execution est loguee :

| Colonne | Description |
|---------|-------------|
| `job_name` | `daily-sync`, `realtime-update`, `manual-update`, `manual-realtime` |
| `status` | `success` ou `error` |
| `message` | Detail du resultat |
| `competitions_updated` | Nombre de competitions/matchs traites |
| `execution_time_ms` | Duree d'execution |
| `created_at` | Timestamp |

### Table `api_calls_log`

Chaque appel API externe est logue :

| Colonne | Description |
|---------|-------------|
| `api_name` | `football-data`, `thesportsdb` |
| `call_type` | `manual`, `realtime`, `fallback-scores` |
| `competition_id` | Competition concernee |
| `success` | Succes ou echec |
| `response_time_ms` | Temps de reponse |

---

## Fichiers cles

| Fichier | Role |
|---------|------|
| [app/api/football/auto-update/route.ts](../app/api/football/auto-update/route.ts) | Pipeline auto-update (global) |
| [app/api/football/realtime-update/route.ts](../app/api/football/realtime-update/route.ts) | Pipeline realtime-update (cible) |
| [lib/native-stats-scraper.ts](../lib/native-stats-scraper.ts) | Scraper native-stats.org |
| [lib/api-football-fallback.ts](../lib/api-football-fallback.ts) | Fallback TheSportsDB |
| [app/api/admin/smart-cron/route.ts](../app/api/admin/smart-cron/route.ts) | Configuration du systeme cron |
| [app/api/admin/pg-cron/route.ts](../app/api/admin/pg-cron/route.ts) | Gestion pg_cron legacy |

---

## Variables d'environnement

| Variable | Requis | Description |
|----------|--------|-------------|
| `FOOTBALL_DATA_API_KEY` | Oui | Cle API football-data.org |
| `NEXT_PUBLIC_APP_URL` | Oui | URL de l'app (pour les appels internes pg_cron) |

---

## Gestion des prolongations

Les matchs de coupe (Champions League, coupes nationales) peuvent avoir des prolongations. Le systeme gere ce cas :

1. **native-stats.org** affiche le score total (incluant prolongations)
2. Le scraper parse la table des buts pour filtrer ceux > 90 min
3. Seul le score a l'issue des 90 minutes reglementaires est retourne
4. Si tous les buts sont en prolongation, le score 90 min est 0-0

> Note : football-data.org retourne `score.fullTime` qui inclut les prolongations pour certaines competitions. Le comportement peut varier.

---

## Depannage

### Les scores ne se mettent pas a jour

1. Verifier que les fenetres de matchs sont generees (admin > Smart Cron > "Generer les fenetres")
2. Verifier que le realtime-update est active et que la frequence est correcte
3. Augmenter la "Marge apres 90 min" a 90 minutes
4. Lancer un auto-update manuel depuis l'admin (bouton "Quotidien")

### Un match reste en "TIMED" alors qu'il est termine

Le fallback native-stats couvre ce cas automatiquement a chaque auto-update. Si le probleme persiste :
1. Verifier que le match existe sur native-stats.org (`https://native-stats.org/match/{matchId}`)
2. Lancer un auto-update manuel
3. Le fallback TheSportsDB prendra le relais apres 3h si le cooldown de 4h est passe

### Un match affiche "En direct" alors qu'il est termine

Cause probable : le match est reste en `IN_PLAY` trop longtemps sans etre mis a jour.
- Le fallback native-stats patch les matchs `IN_PLAY` dont le kickoff est > 3h (devrait etre FINISHED)
- L'auto-update skip les `IN_PLAY` dont le kickoff est > 5h (donnee corrompue)

### Les scores sont faux

1. Verifier la source dans les logs (`football-data`, `native-stats`, ou `thesportsdb`)
2. Pour TheSportsDB : le fuzzy matching des noms peut causer des erreurs (rare)
3. Pour native-stats : verifier que le match n'a pas eu de prolongation mal detectee
