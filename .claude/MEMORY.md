# PronoHub - Notes importantes

## Infrastructure
- **Hébergement** : Serveur Hetzner (PAS Vercel !)
- **Base de données** : Supabase
- **Push notifications** : Firebase Cloud Messaging (FCM)

## Préférences utilisateur
- Tests directement en production après les commits
- Maximum 2 commits par jour (économie de ressources)
- Toujours vérifier que le code compile avant de proposer un commit

## Stack technique
- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Supabase (auth, database, realtime)
- Firebase Admin SDK (notifications push)

## Fonctionnalités récentes
- Réactions chat : 🔥 🏆 😂 👏 🎯 😢 😡
- Réponses aux messages (reply_to)
- Support images dans notifications push (imageUrl)
- Dissociation canaux email/push (channel dans notification_logs)

## Checklist Notifications (images/logos)

| Type | Push Android | Email |
|------|:------------:|:-----:|
| reminder | ✅ | ✅ |
| badge_unlocked | ✅ | ✅ |
| new_matches | ✅ | ✅ |
| tournament_started | ✅ | ✅ |
| tournament_end | ✅ | ✅ |
| invite | N/A | ✅ |
| player_joined | ✅ | ✅ |
| mention | ⬜ | ✅ |
| day_recap | N/A (email only) | ✅ |

**Note:** `day_recap` n'envoie que des emails (pas de push)
**Note:** `invite` push N/A car le destinataire n'est pas encore inscrit (pas de FCM token)

## TODO - Prochaine session
- [ ] **mention** : dernier type push Android restant
  - Créer bg `og-mention-bg.png` + endpoint OG `/api/og/mention`
  - La push est déjà envoyée via `sendNotificationToUser` dans `lib/notifications.ts` (type mention), il faut juste ajouter l'image OG
  - Le push mention est déclenché dans le tchat quand un user @mentionne un autre
  - Clic mène vers `/{tournamentSlug}/opposition?tab=tchat`

## Workflow session
- En début de session : demander le scope (une feature ? plusieurs ? test + deploy ?)
- Email de test pour les notifications : kochroman6@gmail.com
- Endpoint de test : `/api/test-push-image?email=...&mode=push|email|both&trophy=...`
