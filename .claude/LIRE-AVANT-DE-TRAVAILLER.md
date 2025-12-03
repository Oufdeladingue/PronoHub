# PronoHub - Documents a lire AVANT chaque session

## Fichiers OBLIGATOIRES a consulter

### 1. Regles CSS et Themes
**Fichier:** `.claude/development-guidelines.md`

Resume:
- Utiliser les classes CSS thematiques (`theme-accent-bg`, `theme-text`, etc.)
- NE JAMAIS utiliser de styles inline pour les couleurs du theme
- Le systeme de theme utilise `:root[data-theme="dark"]`, PAS les classes `dark:` de Tailwind
- Couleurs principales: #ff9900 (orange), #1e293b (bleu secondaire), #0f172a (bleu fonce)

### 2. Regles de Monetisation
**Fichier:** `.claude/monetization-rules.json` (SOURCE DE VERITE)
**Resume:** `.claude/monetization-rules.md`

Points cles:
- `freekick_count` = nombre de tournois FREE_KICK actifs de l'utilisateur
- Rejoindre ONE_SHOT/ELITE_TEAM: gratuit si freekick_count == 0, sinon 0.99 EUR
- Rejoindre PLATINUM: toujours 6.99 EUR
- Rejoindre PLATINUM_PREPAID: gratuit pour les 11 premiers joueurs
- Creer FREE_KICK: gratuit si freekick_count < 2
- Creer ONE_SHOT: 4.99 EUR / ELITE_TEAM: 9.99 EUR / PLATINUM: 9.99 EUR

### 3. Configuration des Themes
**Fichier:** `THEME_SETUP.md`

Resume:
- Classes disponibles: `.theme-bg`, `.theme-card`, `.theme-text`, `.theme-text-secondary`
- Variables CSS: `--background`, `--foreground`, `--card-bg`, etc.
- Hook: `useTheme()` depuis `@/contexts/ThemeContext`

---

## Checklist avant de coder

- [ ] J'ai lu les regles CSS (pas de styles inline pour les couleurs)
- [ ] J'ai compris les regles de monetisation depuis le JSON
- [ ] Je connais les classes CSS thematiques disponibles
- [ ] Je sais que le theme utilise `data-theme` et non les classes Tailwind `dark:`

---

## Fichiers de reference rapide

| Sujet | Fichier |
|-------|---------|
| CSS/Themes | `.claude/development-guidelines.md` |
| Monetisation (JSON) | `.claude/monetization-rules.json` |
| Monetisation (resume) | `.claude/monetization-rules.md` |
| Setup theme | `THEME_SETUP.md` |
| Types monetisation | `types/monetization.ts` |
