---
name: ux-guard
description: Verifie et ameliore l'experience utilisateur sans casser l'existant. Utilise ce skill quand tu modifies du code UI/UX.
disable-model-invocation: false
user-invocable: true
allowed-tools: Read, Glob, Grep, Bash, Edit, Write, TodoWrite
---

# UX Guard : proteger et ameliorer l'experience utilisateur

Avant et apres chaque modification UI/UX, applique ces regles.

## Principes fondamentaux

1. **Ne jamais degrader l'existant** : toute modification doit ameliorer OU maintenir l'UX actuelle
2. **Mobile first** : PronoHub est majoritairement utilise sur mobile (app Capacitor Android)
3. **Accessibilite** : aria-labels, focus visible, contraste suffisant
4. **Performance percue** : loaders, etats de chargement, transitions fluides

## Checklist avant modification

- [ ] Lire le composant complet avant de modifier
- [ ] Identifier les etats possibles (loading, error, empty, success)
- [ ] Verifier le responsive (mobile 375px, tablet 768px, desktop 1280px)
- [ ] Tester les interactions tactiles (tap targets min 44px)

## Checklist apres modification

- [ ] Les animations/transitions existantes fonctionnent toujours
- [ ] Le scroll n'est pas casse (snap scroll sur landing, scroll normal ailleurs)
- [ ] Les toasts/notifications s'affichent correctement
- [ ] Les modales se ferment bien (backdrop click, bouton fermer, Escape)
- [ ] Le dark theme (fond noir/bleu fonce) est respecte partout
- [ ] Les couleurs de la charte sont utilisees : `#ff9900` (accent), `#0f172a` (fond), `#1e293b` (cards)

## Points d'attention PronoHub

- **Safe area** : respecter `env(safe-area-inset-*)` pour l'app Capacitor
- **Status bar** : fond noir natif (configure dans MainActivity.java)
- **Navigation** : header fixe z-50, ne pas creer de conflit de z-index
- **Chat** : scroll auto vers le bas, reactions accessibles, mentions cliquables
- **Pronos** : inputs numeriques, feedback immediat sur la validation
- **Classements** : animations de position, indicateurs de progression

## Red flags (NE JAMAIS faire)

- Supprimer un feedback visuel existant (loader, toast, animation)
- Changer la navigation sans en discuter avec l'utilisateur
- Modifier les couleurs de la charte sans accord
- Casser le layout mobile pour ameliorer le desktop
- Ajouter des popups/modales non demandees
- Modifier le comportement du bouton retour (hardware back button Android)
