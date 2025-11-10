# Consignes de développement PronoHub

## ⚠️ À LIRE OBLIGATOIREMENT avant chaque session de travail

---

## 1. Classes CSS Thématiques - PRIORITÉ ABSOLUE

### 🎨 Classes utilitaires disponibles (définies dans `app/globals.css`)

**TOUJOURS utiliser ces classes plutôt que des styles inline !**

#### Couleur accent orange (#ff9900)
- `.theme-accent-bg` - Background orange en mode sombre
- `.theme-accent-text` - Texte orange en mode sombre
- `.theme-accent-border` - Bordure orange en mode sombre

#### Couleur secondaire (#1e293b)
- `.theme-secondary-bg` - Background bleu secondaire en mode sombre
- `.theme-secondary-text` - Texte bleu secondaire
- `.theme-secondary-border` - Bordure bleu secondaire

#### Couleur primaire foncée (#0f172a)
- `.theme-dark-bg` - Background bleu foncé en mode sombre
- `.theme-dark-text` - Texte bleu foncé
- `.theme-dark-border` - Bordure bleu foncé

#### Couleur gris-bleu (#94a3b8)
- `.theme-slate-bg` - Background gris-bleu en mode sombre
- `.theme-slate-text` - Texte gris-bleu
- `.theme-slate-border` - Bordure gris-bleu

#### Autres classes dark mode
- `.dark-bg-primary` - Background #0f172a en mode sombre
- `.dark-bg-secondary` - Background #1e293b en mode sombre
- `.dark-border-primary` - Bordure #374151 en mode sombre
- `.dark-border-secondary` - Bordure #475569 en mode sombre
- `.dark-text-accent` - Texte #ff9900 en mode sombre
- `.dark-text-white` - Texte blanc en mode sombre
- `.dark-fill-white` - Fill SVG blanc en mode sombre

#### Boutons thématiques
- `.btn-copy-code` - Bouton copier avec hover (orange en dark, violet en light)
- `.btn-share` - Bouton partager avec hover (orange en dark, bleu en light)

---

## 2. Règles de développement

### ❌ À NE JAMAIS FAIRE
```tsx
// MAUVAIS - Style inline
<div style={{ backgroundColor: theme === 'dark' ? '#ff9900' : '#xxx' }}>

// MAUVAIS - Style inline avec condition
<button style={{ color: theme === 'dark' ? '#ff9900' : '#xxx' }}>

// MAUVAIS - Handlers de hover inline
<button
  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#ff9900'}
  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#xxx'}
>
```

### ✅ À TOUJOURS FAIRE
```tsx
// BON - Classe CSS
<div className="theme-accent-bg">

// BON - Classe CSS pour texte
<button className="theme-accent-text">

// BON - Classe CSS pour bouton avec hover
<button className="btn-copy-code">
```

---

## 3. Processus avant d'ajouter du code

**Avant d'écrire un style inline, TOUJOURS :**

1. ✅ Vérifier si une classe existe dans `app/globals.css`
2. ✅ Vérifier la liste ci-dessus des classes disponibles
3. ✅ Si la classe n'existe pas et que le style sera réutilisé → Créer une nouvelle classe dans `globals.css`
4. ✅ Si le style est vraiment unique et ponctuel → SEULEMENT alors utiliser un style inline

---

## 4. Avantages de cette approche

- 🚀 **Performance** : CSS compilé une fois vs styles inline recalculés à chaque render
- 🧹 **Code propre** : -815 caractères économisés dans le refactoring initial
- 🎯 **Maintenabilité** : Changer une couleur = 1 seul endroit à modifier
- 🎨 **Cohérence** : Garantie d'utiliser les bonnes couleurs du thème
- 📖 **Lisibilité** : Intentions claires avec des noms de classes sémantiques

---

## 5. Système de thème

- **Détection du thème** : Via `:root[data-theme="dark"]`
- **Ne PAS utiliser** : Les classes `dark:` de Tailwind (elles ne fonctionnent pas avec notre système)
- **Contexte** : `useTheme()` disponible via `ThemeContext`

---

## 6. Couleurs principales du projet

| Couleur | Code HEX | Usage |
|---------|----------|-------|
| Orange accent | #ff9900 | Éléments interactifs, accent principal |
| Bleu secondaire | #1e293b | Backgrounds secondaires |
| Bleu foncé | #0f172a | Background principal dark mode |
| Gris-bleu | #94a3b8 | Éléments subtils, bordures |

---

## 7. Checklist avant commit

- [ ] Aucun style inline pour les couleurs du thème (#ff9900, #1e293b, #0f172a, #94a3b8)
- [ ] Les classes CSS utilitaires sont utilisées quand disponibles
- [ ] Pas de handlers onMouseEnter/onMouseLeave pour les couleurs (utiliser les classes avec :hover)
- [ ] Le code respecte le système de thème `:root[data-theme="dark"]`

---

**📌 Note importante : Ce fichier doit être consulté AU DÉBUT de CHAQUE session de travail, que ce soit sur le PC maison ou au travail.**
