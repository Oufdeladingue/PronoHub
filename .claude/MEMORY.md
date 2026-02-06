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
| badge_unlocked | ⬜ | ⬜ |
| new_matches | ⬜ | ⬜ |
| tournament_started | ⬜ | ⬜ |
| tournament_end | ⬜ | ⬜ |
| invite | ⬜ | ⬜ |
| player_joined | ⬜ | ⬜ |
| mention | ⬜ | ⬜ |
| day_recap | ⬜ | ⬜ |
