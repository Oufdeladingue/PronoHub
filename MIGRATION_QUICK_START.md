# 🚀 Migration vers API-Football en 5 Minutes

Guide ultra-rapide pour basculer de football-data.org vers api-football.com

---

## ⚠️ Prérequis

Avant de migrer, assure-toi d'avoir :

✅ **Upgrade vers Plan Pro API-Football** (19€/mois)
- Accès aux saisons actuelles (2024, 2025, etc.)
- 7500 requêtes/jour (vs 100 en gratuit)
- Site : https://www.api-football.com/pricing

✅ **Nouvelle clé API** récupérée depuis ton dashboard API-Football

---

## 📝 Étape 1 : Mettre à jour la clé API (30 secondes)

**Fichier :** `.env.local`

```env
# Remplace par ta nouvelle clé du Plan Pro
API_FOOTBALL_KEY=ta_nouvelle_cle_plan_pro_ici
API_FOOTBALL_HOST=v3.football.api-sports.io
```

---

## 🔧 Étape 2 : Changer le Provider par Défaut (2 minutes)

### 2.1 Route Competitions

**Fichier :** [`app/api/football/competitions/route.ts`](app/api/football/competitions/route.ts)

**Ligne 23 :** Changer de :
```typescript
const provider = searchParams.get('provider') || 'football-data'
```

À :
```typescript
const provider = searchParams.get('provider') || 'api-football'
```

### 2.2 Route Import

**Fichier :** [`app/api/football/import/route.ts`](app/api/football/import/route.ts)

**Ligne 38 :** Changer de :
```typescript
const useProvider = provider || 'football-data'
```

À :
```typescript
const useProvider = provider || 'api-football'
```

---

## 🔄 Étape 3 : Redémarrer le Serveur (30 secondes)

```bash
# Arrêter le serveur (Ctrl+C)
# Relancer
npm run dev
```

---

## ✅ Étape 4 : Tester (1 minute)

### Test 1 : Lister les Compétitions
```
http://localhost:3000/api/football/competitions
```

**Vérifier :**
- ✅ `"provider": "api-football"`
- ✅ `"fromCache": false`
- ✅ Liste des compétitions 2024/2025

### Test 2 : Importer une Compétition
```bash
POST http://localhost:3000/api/football/import
Body: { "competitionId": 39 }  # Premier League
```

**Vérifier :**
- ✅ Import réussi
- ✅ Matchs saison 2024/2025 importés
- ✅ `"provider": "api-football"`

### Test 3 : Vérifier le Quota
```sql
SELECT * FROM current_day_api_usage;
```

**Vérifier :**
- ✅ `total_requests` incrémenté
- ✅ `remaining_requests` mis à jour
- ✅ Logs présents dans `api_request_logs`

---

## 🎯 C'est Tout !

**Migration terminée en 5 minutes ✅**

Ton application utilise maintenant :
- ✅ API-Football.com (saisons actuelles)
- ✅ 7500 requêtes/jour
- ✅ Gestion automatique du quota
- ✅ Monitoring complet

---

## 🔍 Vérification Post-Migration

### 1. Dashboard Admin

Va sur : `http://localhost:3000/admin/import`

**Tu devrais voir :**
- Liste des compétitions depuis API-Football
- Quota affiché en haut (si Phase 5 complétée)
- Import fonctionnel

### 2. Logs Base de Données

```sql
-- Voir les requêtes d'aujourd'hui
SELECT * FROM api_request_logs
WHERE request_date = CURRENT_DATE
ORDER BY created_at DESC;

-- Statistiques
SELECT * FROM current_day_api_usage;
```

### 3. Compétitions Importées

```sql
-- Voir les compétitions avec nouveau provider
SELECT id, name, api_provider, last_updated_at
FROM competitions
WHERE api_provider = 'api-football'
ORDER BY last_updated_at DESC;
```

---

## 🔄 Rollback (si besoin)

Si tu veux revenir à football-data.org :

**1. Dans les routes, rechanger :**
```typescript
// competitions/route.ts ligne 23
const provider = searchParams.get('provider') || 'football-data'

// import/route.ts ligne 38
const useProvider = provider || 'football-data'
```

**2. Redémarrer le serveur**
```bash
npm run dev
```

**C'est tout !** Le système rebascule instantanément.

---

## 📊 Comparaison des Providers

| Critère | football-data.org | API-Football (Pro) |
|---------|-------------------|-------------------|
| **Prix** | Gratuit | 19€/mois |
| **Saisons** | Actuelles | Actuelles + archives |
| **Requêtes/jour** | ~10/min | 7500/jour |
| **Compétitions** | ~30 principales | 1200+ leagues |
| **Données live** | Oui | Oui (15s) |
| **Stats détaillées** | Limitées | Complètes |
| **Prédictions** | Non | Oui |
| **Cotes** | Non | Oui |

---

## 🎁 Bonus : Nouvelles Fonctionnalités Disponibles

Une fois migré vers API-Football Pro, tu peux ajouter :

### 1. Statistiques Avancées
- Possession, tirs, corners, cartons
- Stats par joueur
- Top scorers, assists

### 2. Prédictions IA
- Prédictions de matchs
- Pourcentages de victoire
- Suggestions de pronostics

### 3. Cotes des Bookmakers
- Comparaison de cotes
- Évolution des cotes
- Value bets

### 4. Plus de Compétitions
- Accès à 1200+ leagues mondiales
- Championnats mineurs
- Coupes nationales

**Code déjà prêt !** Tous les endpoints sont disponibles dans [`lib/api-football-client.ts`](lib/api-football-client.ts)

---

## 📞 Support

**Problème pendant la migration ?**

1. **Vérifier les logs serveur** : `npm run dev` (console)
2. **Vérifier table logs** : `SELECT * FROM api_request_logs`
3. **Tester avec curl** :
   ```bash
   curl http://localhost:3000/api/football/competitions?provider=api-football
   ```
4. **Consulter** [`MIGRATION_STATUS.md`](MIGRATION_STATUS.md) pour détails techniques

**Erreur commune :** "Plan gratuit, saisons 2021-2023 uniquement"
→ **Solution :** Vérifie que tu as bien upgradé vers Plan Pro et mis à jour la clé API

---

## 🏆 Checklist Migration

Avant de considérer la migration terminée :

- [ ] Plan Pro API-Football activé
- [ ] Nouvelle clé API dans `.env.local`
- [ ] Provider par défaut changé dans 2 routes
- [ ] Serveur redémarré
- [ ] Test liste compétitions OK
- [ ] Test import compétition OK
- [ ] Quota incrémenté dans BDD
- [ ] Anciens imports conservés
- [ ] Dashboard admin fonctionnel

---

## 📈 Suivi Post-Migration

### Semaine 1
- Surveiller `daily_api_usage` tous les jours
- Vérifier que quota ne dépasse pas 7500 req/jour
- Ajuster fréquence auto-refresh si besoin

### Mois 1
- Analyser patterns d'utilisation
- Optimiser les appels si possible
- Considérer activation scheduler intelligent

### Long Terme
- Si usage > 5000 req/jour régulièrement → considérer Plan Ultra (75000 req/jour)
- Implémenter cache Redis pour ultra-performance
- Activer fonctionnalités bonus (prédictions, cotes)

---

**Migration réussie ! 🎉**

Tu profites maintenant de :
- Saisons actuelles
- 7500 requêtes/jour
- Données complètes
- Monitoring intelligent
- Prêt pour scale

**Questions ?** Consulte [`MIGRATION_API_FOOTBALL_FEASIBILITY.md`](MIGRATION_API_FOOTBALL_FEASIBILITY.md) pour la doc complète.
