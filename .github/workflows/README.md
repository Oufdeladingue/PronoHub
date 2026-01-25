# GitHub Actions - Crons PronoHub

Ce dossier contient les workflows GitHub Actions qui remplacent les crons Vercel pour une meilleure fiabilité.

## 📋 Workflows configurés

### 1. `send-reminders.yml` - Envoi des rappels de pronostics
**Fréquence**: 4 fois par jour
- 9h (heure française) - 8h UTC
- 10h (heure française) - 9h UTC
- 11h (heure française) - 10h UTC
- 12h (heure française) - 11h UTC

**Fonctionnement**:
- Appelle `GET /api/cron/send-reminders`
- Envoie un email aux utilisateurs ayant des pronostics manquants
- Évite les doublons (1 seul email par jour par utilisateur)

### 2. `update-matches.yml` - Mise à jour des matchs
**Fréquence**: 1 fois par jour à 7h (heure française) - 6h UTC

**Fonctionnement**:
- Appelle `GET /api/cron/update-matches`
- Met à jour les données des matchs depuis l'API Football

## 🔐 Configuration requise

### Secret GitHub nécessaire: `CRON_SECRET`

1. Va sur ton repo GitHub: https://github.com/Oufdeladingue/PronoHub
2. Clique sur **Settings** > **Secrets and variables** > **Actions**
3. Clique **New repository secret**
4. Nom: `CRON_SECRET`
5. Valeur: La même valeur que `CRON_SECRET` dans tes variables d'environnement Vercel

**Important**: Le `CRON_SECRET` doit être identique entre:
- Variables d'environnement Vercel (déjà configuré)
- GitHub Secrets (à ajouter)

## 🧪 Test manuel

Tu peux tester les workflows manuellement:

1. Va sur **Actions** dans ton repo GitHub
2. Sélectionne le workflow (ex: "Send Reminder Emails")
3. Clique **Run workflow** > **Run workflow**
4. Vérifie les logs pour voir le résultat

## 📊 Monitoring

Les logs de chaque exécution sont disponibles dans:
- **GitHub**: Onglet Actions > Sélectionne le workflow > Sélectionne l'exécution
- **PronoHub**: https://www.pronohub.club/admin/logs

## ⚠️ Limitations GitHub Actions

- **Délai possible**: ±5-10 minutes par rapport à l'heure programmée
- **Quota**: 2000 minutes/mois (repos privé) ou illimité (repos public)
- **Consommation estimée**: ~60 minutes/mois (4 exécutions/jour × 30 jours × 30 secondes)

## 🔄 Désactiver Vercel Crons

Une fois que GitHub Actions fonctionne, tu peux:
1. Supprimer ou commenter les crons dans `vercel.json`
2. Ou les laisser comme backup (mais ils risquent de créer des doublons)

Recommandation: **Supprimer les crons Vercel** pour éviter les doublons.
