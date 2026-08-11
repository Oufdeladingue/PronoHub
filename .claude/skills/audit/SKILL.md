---
name: audit
description: Audit complet securite, performance, SEO et UI d'une page ou feature
argument-hint: "[page ou feature a auditer]"
allowed-tools: Read, Glob, Grep, Bash, WebFetch, WebSearch, TodoWrite
agent: Explore
---

# Audit PronoHub : Securite, Performance, SEO, UI

Lance un audit complet de la page ou feature specifiee dans `$ARGUMENTS`.
Si aucun argument, auditer la derniere page/feature modifiee.

## 1. Audit Securite (OWASP)

Verifier :
- [ ] Pas d'injection XSS (sanitization des inputs, `dangerouslySetInnerHTML` absent)
- [ ] Pas d'injection SQL (Supabase parametrise les requetes, mais verifier les `.rpc()`)
- [ ] Auth verifiee dans chaque API route (`supabase.auth.getUser()`)
- [ ] Pas de secrets exposes cote client (verifier que seuls les `NEXT_PUBLIC_*` sont utilises)
- [ ] Rate limiting sur les endpoints sensibles (auth, contact, stripe)
- [ ] CSP headers (Content-Security-Policy dans next.config)
- [ ] CORS configure correctement
- [ ] Pas de donnees sensibles dans les logs (`console.log` avec user data)

## 2. Audit Performance

Verifier :
- [ ] Images optimisees (format, taille, lazy loading)
- [ ] Note : `unoptimized` est VOLONTAIRE sur les images (serveur Hetzner sans sharp)
- [ ] Pas de re-renders inutiles (useCallback, useMemo si necessaire)
- [ ] Pas de requetes N+1 vers Supabase (utiliser les joins)
- [ ] Bundle size (pas d'import de librairie entiere, utiliser le tree-shaking)
- [ ] Composants `'use client'` uniquement quand necessaire
- [ ] `priority` sur les images above-the-fold (hero, logo)
- [ ] Pas de layout shift (CLS) — dimensions explicites sur les images

## 3. Audit SEO

Verifier :
- [ ] Metadata (title, description, og:*, twitter:*)
- [ ] Structure semantique (h1 unique, h2-h6 hierarchiques)
- [ ] JSON-LD / structured data si pertinent
- [ ] `canonical` URL defini
- [ ] Alt text sur les images significatives (pas les decoratives)
- [ ] Sitemap a jour (`/sitemap.xml`)
- [ ] Pas de contenu cache au robots (sauf admin panel)

## 4. Audit UI/UX

Verifier :
- [ ] Responsive : mobile (375px), tablet (768px), desktop (1280px)
- [ ] Accessibilite : aria-labels, focus visible, contraste
- [ ] Z-index coherents (backdrop, modales, header, tooltips)
- [ ] Transitions/animations fluides
- [ ] Etats vides, erreurs et chargement geres
- [ ] Charte graphique respectee (#ff9900, #0f172a, #1e293b)

## Format du rapport

Pour chaque categorie, donner :
- **Score** : X/10
- **Issues critiques** (a corriger immediatement)
- **Ameliorations** (nice to have)
- **Points positifs** (ce qui est bien fait)

Conclure avec un tableau recapitulatif et les actions prioritaires.
