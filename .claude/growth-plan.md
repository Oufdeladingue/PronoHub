# PronoHub - Plan d'Acquisition & Growth

> Audit realise le 12/02/2026

---

## 1. AUDIT SEO TECHNIQUE - Score : 72/100

### Ce qui est bien fait
- Meta tags complets (title, description, og:image) sur toutes les pages publiques
- Sitemap dynamique (`app/sitemap.ts`) avec 8 URLs et priorites
- Robots.txt bien configure (pages privees bloquees, API exclues)
- JSON-LD en place (Organization + WebApplication)
- Images OG dynamiques pour push/emails (badge, reminder, tournament-start/end...)
- Canonical URLs sur toutes les pages publiques
- Fonts optimisees (next/font, `display: swap`)
- Headers de securite excellents (CSP, HSTS, X-Frame-Options)
- Open Graph complet (og:title, og:description, og:image 1200x630, Twitter cards)
- Images optimisees avec next/image (lazy loading, WebP, priority)
- Preconnect/prefetch vers Supabase

### Problemes critiques
- **Homepage en CSR** (`'use client'` dans `app/page.tsx`) - Google voit une page quasi vide
- **Page About en CSR** - contenu de marque invisible pour les crawlers
- **Page Contact en CSR** - meme probleme
- **Aucun analytics** - pas de GA, Plausible, PostHog, ni Vercel Analytics

### Manquant
- Pas de schema FAQ sur la page pricing (rich snippets possibles)
- Pas de BreadcrumbList schema
- Pas de AggregateRating schema
- Pas de PriceRange dans le schema WebApplication

### Pages et leur rendu

| Page | Rendu | Status |
|------|-------|--------|
| `/` (Homepage) | CSR | A corriger |
| `/pricing` | SSR + CSR hybride | OK |
| `/about` | CSR | A corriger |
| `/contact` | CSR | A corriger |
| `/auth/*` | CSR | Acceptable |
| `/cgv` | SSR | OK |
| `/privacy` | SSR | OK |

---

## 2. TUNNEL DE CONVERSION - Points de friction

### Parcours actuel
```
Landing -> Signup (email+mdp OU Google) -> OTP email -> Choose username -> Dashboard -> Creer/Rejoindre tournoi
```

### Frictions majeures
1. **Mode maintenance actif** en prod - la landing montre "Coming Soon"
2. **Pas de boutons de partage de tournoi** - les users doivent communiquer le code a 8 caracteres manuellement
3. **Pas de decouverte de tournois** - aucune suggestion pour les nouveaux inscrits
4. **Pas de systeme de parrainage** - pas de recompense pour inviter des amis
5. **Pas d'onboarding guide** - apres le choix de pseudo, l'user arrive sur un dashboard vide
6. **Code d'invitation 8 caracteres** - difficile a partager a l'oral ou par SMS
7. **Paywall surprise** - le 3e tournoi gratuit declenche un paiement inattendu

### Systeme d'invitation actuel
- Code 8 caracteres alphanumerique
- API email d'invitation (`/api/email/invite`) existe mais PAS d'UI pour l'utiliser
- Partage social (WhatsApp, Facebook, Messenger) existe UNIQUEMENT pour les trophees
- Pas de QR code, pas de deep links, pas de liens courts

---

## 3. FEATURES GROWTH EXISTANTES

### Implemente
- **Push notifications** : FCM via Capacitor, modal de permission bien designee
- **Emails transactionnels** : rappels, recaps, trophees, invitations, reactivation
- **Gamification** : 16 trophees, points, bonus match, classements
- **Admin communications** : panel pour envoyer des campagnes email/push
- **Preferences de notification** : granulaires par type
- **Reactivation** : email apres 10j d'inactivite

### Manquant
- **Analytics** : aucun outil installe
- **Systeme de parrainage** : pas de tracking inviteur/invite
- **Boutons de partage social** : absents du frontend
- **PWA** : pas de manifest, pas d'install prompt
- **Streaks** : pas de suivi de jours consecutifs
- **Classements saisonniers** : pas de leaderboards mensuels
- **Defis quotidiens** : pas de quetes/challenges
- **Blog/contenu SEO** : pas de pages de contenu organique

---

## 4. PLAN D'ACQUISITION PAR CANAL

### Canal 1 : Viral / Bouche-a-oreille (PRIORITE #1)
Le levier n1 pour une app sociale entre amis.

**Actions :**
- Implementer un **bouton "Inviter des amis"** dans chaque tournoi (WhatsApp, SMS, copier lien)
- Creer des **liens courts** : `pronohub.club/join/ABCDEFGH`
- Ajouter un **QR code** pour chaque tournoi
- **Systeme de parrainage** : "Invite 3 amis = 1 tournoi One-Shot offert"
- **Partage de classement** sur les reseaux (image OG avec le classement du joueur)
- Ajouter les boutons de partage existants (trophees) aux tournois aussi

### Canal 2 : SEO organique (PRIORITE #2)
Trafic gratuit et durable.

**Actions :**
- Convertir homepage/about/contact en **SSR** (contenu crawlable)
- Creer des **pages de contenu SEO** :
  - `/pronostics-ligue-1` - resultats et classements live
  - `/comment-pronostiquer` - guide pour debutants
  - `/meilleurs-pronostiqueurs` - classement public
- Ajouter le **schema FAQ** sur la page pricing
- Installer **Google Search Console** + soumettre le sitemap
- Schema BreadcrumbList sur les pages avec hierarchie

### Canal 3 : Reseaux sociaux (PRIORITE #3)
Pas de SEO direct, mais trafic + notoriete.

**Actions :**
- Creer un compte **Twitter/X** et **Instagram** PronoHub
- Poster des **classements de la semaine** (image auto-generee via OG)
- **TikTok/Reels** : videos courtes "Mon prono du week-end"
- **Reddit** : r/Ligue1, r/soccer - etre actif dans les communautes foot

### Canal 4 : Communautes (PRIORITE #4)
**Actions :**
- Cibler les **groupes WhatsApp/Telegram/Discord** de fans de foot
- Partenariats avec des **comptes foot** (influenceurs micro/nano)
- Presence sur les **forums** (jeuxvideo.com, sport24, etc.)

### Canal 5 : ASO - App Store Optimization
**Actions :**
- Publier sur le **Google Play Store** avec :
  - Titre optimise : "PronoHub - Pronostics Foot entre Amis"
  - Screenshots des fonctionnalites cles
  - Description avec mots-cles (pronostics, paris amis, tournoi foot)
- Strategie d'**avis positifs** (demander un avis apres 1er podium)

---

## 5. ACTIONS TECHNIQUES A IMPLEMENTER

### Semaine 1 - Quick wins critiques

| Action | Impact | Effort |
|--------|--------|--------|
| Desactiver le mode maintenance | Bloquant | 5 min |
| Convertir homepage en SSR | SEO x2 | 2-3h |
| Ajouter boutons de partage tournoi (WhatsApp, copier lien) | Viral | 3-4h |
| Installer Plausible ou PostHog analytics | Mesure | 1-2h |
| Ajouter Google Search Console | SEO | 30 min |

### Semaine 2 - Growth loops

| Action | Impact | Effort |
|--------|--------|--------|
| Systeme de parrainage (invite friends -> reward) | Viral | 4-6h |
| QR code pour les tournois | Partage | 2h |
| Liens courts `/join/CODE` | UX partage | 1-2h |
| Onboarding guide (CTA "Cree ton 1er tournoi") | Conversion | 2-3h |
| Email digest hebdomadaire | Retention | 3-4h |

### Semaine 3 - Contenu SEO

| Action | Impact | Effort |
|--------|--------|--------|
| Convertir pages About/Contact en SSR | SEO | 1-2h |
| Schema FAQ sur pricing | Rich snippets | 1h |
| Page `/comment-pronostiquer` (guide SEO) | Trafic organique | 3-4h |
| Partage de classement sur reseaux (image OG) | Social/Viral | 3h |
| PWA manifest + install prompt | Retention mobile | 2-3h |

### Semaine 4 - Engagement & retention

| Action | Impact | Effort |
|--------|--------|--------|
| Systeme de streaks (X jours consecutifs) | Engagement | 4-5h |
| Classements mensuels/saisonniers | Competition | 3-4h |
| Defis quotidiens | Engagement | 4-5h |
| Demande d'avis Play Store apres 1er podium | ASO | 1-2h |

---

## 6. KPIs A SUIVRE

Une fois les analytics installes :

| KPI | Cible | Description |
|-----|-------|-------------|
| Taux d'inscription | >15% | Visiteurs landing -> inscription |
| Taux 1er tournoi | >60% | Inscrits -> creation/participation 1er tournoi |
| Taux d'invitation | >30% | Users qui invitent au moins 1 ami |
| Coefficient viral | >1.0 | Nb moyen d'invites qui s'inscrivent par user |
| Retention J1 | >50% | Users actifs le lendemain |
| Retention J7 | >30% | Users actifs apres 7 jours |
| Retention J30 | >15% | Users actifs apres 30 jours |
| DAU/MAU ratio | >20% | Engagement quotidien |
| Conversion premium | >5% | Free -> payant |

---

## 7. RESUME DES PRIORITES

1. **Viral** : boutons de partage + parrainage + liens courts (levier #1)
2. **SEO** : SSR des pages critiques + contenu organique
3. **Analytics** : mesurer avant d'optimiser
4. **Retention** : streaks, digest, classements
5. **ASO** : Play Store optimization
