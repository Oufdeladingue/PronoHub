# Configuration de la Mise à Jour Automatique des Compétitions

## Vue d'ensemble

Le système de mise à jour automatique permet de synchroniser automatiquement les données des compétitions actives depuis l'API Football-Data sans intervention manuelle.

## Fonctionnement

### Ce qui est mis à jour automatiquement:
- ✅ Informations des compétitions (nom, emblème, journée actuelle, etc.)
- ✅ Tous les matchs (scores, statuts, dates)
- ✅ Date de dernière mise à jour (`last_updated_at`)

### Ce qui est mis à jour:
Uniquement les **compétitions actives** (celles avec le toggle vert dans l'admin/import)

## Installation

### Option 1: Tâche planifiée Windows (Recommandé)

1. **Ouvrir PowerShell en tant qu'administrateur**
   - Clic droit sur le menu Démarrer → "Windows PowerShell (Admin)"

2. **Naviguer vers le dossier du projet**
   ```powershell
   cd C:\Users\mjardin\Desktop\PronoHub
   ```

3. **Exécuter le script de configuration**
   ```powershell
   .\schedule-auto-update.ps1
   ```

4. **Choisir l'intervalle de mise à jour**
   - Option 5 (toutes les 2 heures) est recommandée pour éviter de consommer trop de quota API

5. La tâche planifiée est maintenant active! Elle s'exécutera automatiquement en arrière-plan.

### Option 2: Exécution manuelle

Pour tester ou exécuter manuellement la mise à jour:

```powershell
.\auto-update-competitions.ps1
```

## Vérification

### Vérifier que la tâche est active:

1. Ouvrir le **Planificateur de tâches Windows**
2. Chercher la tâche: **PronoHub - Auto-Update Competitions**
3. Vérifier:
   - ✅ État: "Prêt"
   - ✅ Dernière exécution
   - ✅ Prochaine exécution

### Vérifier les dates de mise à jour:

1. Aller sur [http://localhost:3000/admin/import](http://localhost:3000/admin/import)
2. Vérifier que la date "MAJ: le XX/XX/XX à XX:XX" correspond à la dernière exécution

## Gestion

### Désactiver temporairement la mise à jour automatique:

```powershell
Disable-ScheduledTask -TaskName "PronoHub - Auto-Update Competitions"
```

### Réactiver la mise à jour automatique:

```powershell
Enable-ScheduledTask -TaskName "PronoHub - Auto-Update Competitions"
```

### Supprimer complètement la tâche planifiée:

```powershell
Unregister-ScheduledTask -TaskName "PronoHub - Auto-Update Competitions" -Confirm:$false
```

### Modifier l'intervalle:

Relancez simplement `.\schedule-auto-update.ps1` avec un nouvel intervalle.

## Intervalles recommandés

| Intervalle | Cas d'usage | Quota API |
|-----------|-------------|-----------|
| 5 minutes | Tests uniquement | ⚠️ Très élevé |
| 15 minutes | Développement | ⚠️ Élevé |
| 30 minutes | Match days actifs | Moyen |
| 1 heure | Usage régulier | Bas |
| **2 heures** | **Production (recommandé)** | ✅ Optimal |
| 6 heures | Faible activité | Minimal |

## Logs et Débogage

### Voir les logs de la dernière exécution:

Dans le Planificateur de tâches:
1. Clic droit sur la tâche → Propriétés
2. Onglet "Historique"

### Tester manuellement l'API:

```bash
curl -X POST http://localhost:3000/api/football/auto-update
```

## Notes importantes

- ⚠️ **Le serveur Next.js doit être en cours d'exécution** pour que la mise à jour fonctionne
- ⚠️ Vérifiez votre quota API Football-Data pour éviter de le dépasser
- ✅ Les compétitions désactivées (toggle rouge) ne sont jamais mises à jour automatiquement
- ✅ La date `last_updated_at` est mise à jour après chaque synchronisation réussie

## API Endpoint

### POST /api/football/auto-update

Déclenche la mise à jour de toutes les compétitions actives.

**Réponse:**
```json
{
  "success": true,
  "message": "Auto-update completed: 3 successful, 0 failed",
  "totalCompetitions": 3,
  "successCount": 3,
  "failureCount": 0,
  "results": [
    {
      "competitionId": 2002,
      "name": "Bundesliga",
      "code": "BL1",
      "success": true,
      "matchesCount": 306
    }
  ]
}
```

## Dépannage

### La tâche ne s'exécute pas:

1. Vérifier que le serveur Next.js est démarré (`npm run dev`)
2. Vérifier les logs dans le Planificateur de tâches
3. Tester manuellement: `.\auto-update-competitions.ps1`

### Erreur "API key not configured":

Vérifier que `FOOTBALL_DATA_API_KEY` est défini dans `.env.local`

### Erreur de quota API dépassé:

Augmenter l'intervalle de mise à jour (passer à 6 heures par exemple)
