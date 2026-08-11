---
name: stack
description: Contexte technique complet de PronoHub. Charge automatiquement quand les decisions d'architecture ou d'infra sont necessaires.
disable-model-invocation: false
user-invocable: true
---

# Stack technique PronoHub

Charge ce contexte pour toute decision technique, choix de librairie, ou configuration d'infra.

## Hebergement : Hetzner + Coolify

- **PAS Vercel** — le projet tourne sur un serveur Hetzner dedie
- **Coolify** gere le deploiement (docker, auto-deploy sur push main)
- **Consequences** :
  - `sharp` n'est pas installe -> `unoptimized` sur les images Next.js
  - Pas de Edge Functions Vercel -> middleware classique Node.js
  - Pas de ISR Vercel natif -> SSR ou pages statiques
  - Build trigger = push sur `main` -> **max 2 commits/jour** pour economiser les ressources
  - Les variables d'env sont dans Coolify, pas dans Vercel dashboard
  - Le domaine `www.pronohub.club` pointe vers le serveur Hetzner

## Framework : Next.js (App Router)

- **Version** : 16.x avec Turbopack
- **Rendering** : mix SSR (`ƒ`) et static (`○`)
- **Middleware** : `middleware.ts` pour auth, redirections, CORS
- Le middleware est marque "deprecated" par Next.js 16 (migration vers `proxy` a terme)
- `'use client'` uniquement quand necessaire (interactivite, hooks, browser APIs)

## Base de donnees : Supabase

- **Auth** : Supabase Auth (email, Google, Facebook)
- **Database** : PostgreSQL via Supabase
- **Realtime** : Supabase Realtime pour le chat
- **Storage** : pas utilise (images en static dans `/public`)
- **Client** : `@supabase/ssr` pour le SSR, `@supabase/supabase-js` cote client
- **Service role** : utilise dans les crons et operations admin uniquement
- **RLS** : actif sur les tables sensibles

## App mobile : Capacitor (Android)

- **Build** : Gradle (`android/app/build.gradle`)
- **Auth** : token custom via deep links
- **Push** : Firebase Cloud Messaging (FCM) via Firebase Admin SDK
- **Particularites** :
  - `sessionStorage` peut etre indisponible
  - Safe area insets a respecter (`env(safe-area-inset-*)`)
  - Status bar noire (configuree dans `MainActivity.java`)
  - Bouton retour hardware a gerer

## Paiement : Stripe

- Checkout Sessions + Customer Portal
- Webhooks pour les events (subscription, payment)
- Credits systeme (pas d'abonnement recurrent pour l'instant)

## Notifications

- **Push Android** : Firebase Cloud Messaging (FCM) via `firebase-admin`
- **Email** : templates HTML custom, envoi via Supabase (ou SMTP)
- **Types** : reminder, badge_unlocked, new_matches, tournament_started, tournament_end, invite, player_joined, mention, day_recap
- `day_recap` = email uniquement (pas de push)

## Outils de dev

- **IDE** : VSCode
- **CLI** : Claude Code (ce skill !)
- **Package manager** : npm
- **Linter** : ESLint (Next.js config)
- **CSS** : Tailwind CSS v4
- **Icons** : SVG custom dans `/public/images/icons/`

## Conventions de code

- TypeScript strict
- Imports avec `@/` (alias vers la racine)
- API routes dans `app/api/`
- Composants pages dans `app/[route]/page.tsx`
- Libs/utils dans `lib/`
- Contextes React dans `contexts/`
- Pas de tests unitaires (tests manuels en prod)
- Commits convention : `feat:`, `fix:`, `refactor:`, `chore:`

## Points d'attention recurrents

1. **Ne pas utiliser `sharp`** — le serveur Hetzner n'a pas le module natif
2. **Ne pas proposer Vercel** — tout est sur Hetzner/Coolify
3. **Ne pas ajouter de deps lourdes** — chaque dep augmente le temps de build
4. **Toujours verifier le build** (`npm run build`) avant de commit
5. **`getUser()` pas `getSession()`** — Supabase recommande getUser() pour la securite
6. **Les images push utilisent des OG images dynamiques** via `/api/og/*`
