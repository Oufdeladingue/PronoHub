---
name: dev
description: Lance le serveur local, itere sur une feature, puis commit et push une fois validee
argument-hint: "[description de la feature]"
allowed-tools: Bash, Read, Edit, Write, Glob, Grep, TodoWrite
---

# Workflow Dev : iterer en local puis deployer

Tu es en mode dev local pour PronoHub. Suis ce workflow strict :

## 1. Lancement du serveur local

- Lance `npm run dev` en arriere-plan si ce n'est pas deja fait
- Confirme que le serveur tourne sur http://localhost:3000
- Si une erreur survient, la corriger avant de continuer

## 2. Iteration sur la feature

- Lis et comprends le code existant AVANT de modifier quoi que ce soit
- Fais les modifications demandees par l'utilisateur
- Apres chaque modification significative, rappelle a l'utilisateur de verifier en local sur http://localhost:3000
- Attends la validation de l'utilisateur avant de passer a l'etape suivante
- Si l'utilisateur signale un probleme, corrige-le et re-propose la verification

## 3. Pre-commit checklist

Une fois la feature validee par l'utilisateur :

- [ ] Verifier la compilation : `npm run build`
- [ ] S'assurer qu'il n'y a pas de `console.log` de debug oublies
- [ ] Verifier qu'aucun fichier sensible n'est dans le staging (.env, credentials, .psd)
- [ ] Regrouper les changements en un seul commit coherent

## 4. Commit et push

- Proposer un message de commit clair (convention : `feat:`, `fix:`, `refactor:`, etc.)
- Attendre la validation du message par l'utilisateur
- Commit + push sur main
- Confirmer le push reussi

## Regles importantes

- **Maximum 2 commits par jour** (economie de build sur le serveur Hetzner/Coolify)
- **Ne JAMAIS commit sans build reussi**
- **Regrouper les petits changements** en un commit unique
- L'utilisateur teste en production apres le push
