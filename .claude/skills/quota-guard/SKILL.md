---
name: quota-guard
description: Protege les quotas d'API externes, emails, push et base de donnees. Se charge automatiquement quand du code touche aux envois ou appels externes.
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Glob, Grep, Edit, Write, Bash, TodoWrite
---

# Quota Guard : economiser les ressources externes

PronoHub tourne sur des plans avec des quotas limites. Chaque appel externe coute. Ce skill s'applique des qu'on touche au code qui envoie des emails, push, appels API ou ecrit massivement en base.

## Services et leurs limites

### Resend (Emails)
- **Plan** : gratuit/starter avec limite journaliere
- **Fichier cle** : `lib/email/send.ts`, `lib/email/resend.ts`
- **Throttle actuel** : 600ms entre chaque envoi dans les crons
- **Comptes bloques** : `admin@test.fr`, `joueur1@test.fr`, `joueur2@test.fr`
- **Regles** :
  - TOUJOURS garder le delay de 600ms entre les envois sequentiels
  - TOUJOURS verifier `notification_logs` avant d'envoyer (eviter les doublons)
  - TOUJOURS filtrer les comptes de test
  - Privilegier le batching : 1 email recapitulatif > N emails individuels
  - Ne JAMAIS envoyer d'email dans une boucle sans delay

### Firebase FCM (Push notifications)
- **Plan** : gratuit avec limites elevees mais pas infinies
- **Fichier cle** : `lib/firebase-admin.ts`
- **Regles** :
  - Utiliser `sendEachForMulticast()` pour les envois groupes (1 appel API = N tokens)
  - Ne JAMAIS envoyer un push par iteration de boucle sans regroupement
  - Verifier les preferences utilisateur AVANT d'envoyer (`notification_preferences`)
  - Respecter le canal : `day_recap` = email uniquement, pas de push

### API-Football (donnees football)
- **Quota** : 100 requetes/jour (plan gratuit)
- **Fichier cle** : `lib/api-football-quota.ts`
- **Seuils** : WARNING a 40%, CRITICAL a 20% restant
- **Regles** :
  - TOUJOURS utiliser `ApiFootballQuotaManager.canPerformOperation()` avant un appel
  - TOUJOURS logger dans `api_request_logs`
  - Ne JAMAIS appeler l'API en boucle sans verifier le quota restant
  - Privilegier les endpoints qui retournent plusieurs matchs en 1 appel

### football-data.org (API principale)
- **Quota** : limite par minute (plan free = 10 req/min)
- **Fichier cle** : `app/api/football/sync-scores/route.ts`
- **Regles** :
  - Regrouper les requetes par competition (1 requete = tous les matchs d'une journee)
  - Ne pas rafraichir les competitions inactives
  - Le cron `update-matches` ne doit traiter que les competitions avec matchs en cours

### Stripe
- **Fichier cle** : `lib/stripe-client.ts`
- **Rate limit** : 3 checkouts/min/user (deja en place dans `lib/rate-limit.ts`)
- **Regles** :
  - Ne JAMAIS creer de checkout session dans une boucle
  - Verifier `isStripeEnabled` avant tout appel

### Supabase (base de donnees)
- **Plan** : Pro avec limites de rows
- **Regles** :
  - Utiliser `.in()` avec batches de 500 max (limitation Supabase)
  - Privilegier `upsert` sur `delete` + `insert`
  - Eviter les SELECT * en boucle — utiliser les joins Supabase
  - Les `notification_logs` grossissent vite — ne pas dupliquer les logs

## Checklist avant modification de code d'envoi

- [ ] Y a-t-il un delay entre les envois sequentiels ? (min 600ms pour les emails)
- [ ] Les doublons sont-ils verifies ? (check `notification_logs` ou `api_request_logs`)
- [ ] Le batching est-il utilise quand possible ?
- [ ] Les comptes de test sont-ils exclus ?
- [ ] Les preferences utilisateur sont-elles respectees ?
- [ ] Le quota restant est-il verifie avant les appels API externes ?

## Patterns a TOUJOURS utiliser

```typescript
// Email : delay obligatoire entre envois
for (const user of users) {
  await sendEmail(user)
  await new Promise(resolve => setTimeout(resolve, 600))
}

// Push : multicast plutot que boucle
const tokens = users.flatMap(u => u.fcm_tokens)
await admin.messaging().sendEachForMulticast({ tokens, notification })

// API Football : toujours checker le quota
const check = await ApiFootballQuotaManager.canPerformOperation('sync')
if (!check.allowed) return // stop

// Supabase : batch les .in()
for (let i = 0; i < ids.length; i += 500) {
  const batch = ids.slice(i, i + 500)
  await supabase.from('table').select('*').in('id', batch)
}
```

## Patterns INTERDITS

```typescript
// INTERDIT : email sans delay
users.forEach(async u => await sendEmail(u)) // pas de delay !

// INTERDIT : push individuel en boucle
for (const token of tokens) {
  await admin.messaging().send({ token, notification }) // 1 appel par token !
}

// INTERDIT : API sans quota check
const data = await fetch('https://api-football.com/...') // pas de check !

// INTERDIT : select * sans limit
const { data } = await supabase.from('big_table').select('*') // potentiellement 100k rows
```

## En cas de doute

Si tu n'es pas sur du volume d'envoi, **demande a l'utilisateur** avant d'implementer. Mieux vaut une confirmation de trop qu'un quota brule.
