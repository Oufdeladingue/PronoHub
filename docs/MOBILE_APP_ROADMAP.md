# PronoHub - Roadmap Application Mobile

> Documentation pour la future migration vers les stores mobile (Google Play / App Store)

## Solution recommandée : Capacitor

**Capacitor** (par Ionic) permet de réutiliser ~95% du code Next.js existant pour créer des apps natives.

### Avantages
- Open source et **gratuit**
- Un seul codebase pour Web + iOS + Android
- Accès aux APIs natives (push notifications, stockage local, etc.)
- Pas besoin d'apprendre Swift/Kotlin

### Estimation effort
| Étape | Durée estimée |
|-------|---------------|
| Configuration initiale | 2-3 jours |
| Adaptation UI mobile | 1 semaine (déjà responsive) |
| Push notifications natives | 3-4 jours |
| Tests sur devices | 1 semaine |
| Soumission stores | 3-5 jours (review Apple/Google) |
| **Total** | **~3-4 semaines** |

---

## Coûts

### Outils (gratuits)
| Outil | Coût | Notes |
|-------|------|-------|
| Capacitor | Gratuit | Open source |
| Codemagic (CI/CD) | Gratuit | 500 min/mois Linux, 120 min/mois Mac |

### Stores (obligatoires)
| Store | Coût | Notes |
|-------|------|-------|
| Google Play | 25€ (une fois) | Paiement unique à vie |
| Apple App Store | 99€/an | Abonnement annuel obligatoire |

**Total première année** : ~124€
**Années suivantes** : 99€/an (Apple uniquement)

---

## Contraintes techniques

### Android
- Développement et build possibles sur **PC Windows**
- Aucune contrainte matérielle

### iOS
- Développement possible sur **PC Windows**
- Build (.ipa) nécessite un **Mac** ou service cloud
- Soumission App Store nécessite un **Mac** ou service cloud

### Solutions sans Mac pour iOS
| Service | Coût | Notes |
|---------|------|-------|
| Codemagic | Gratuit (120 min/mois) | Recommandé - CI/CD spécialisé mobile |
| MacInCloud | ~30€/mois | Mac virtuel en ligne |
| GitHub Actions + Fastlane | Gratuit (limité) | Plus complexe à configurer |

---

## Estimation builds Codemagic

Pour PronoHub avec mises à jour occasionnelles :

| Plateforme | Temps/build | Builds/mois | Total |
|------------|-------------|-------------|-------|
| Android | ~5-10 min | 4-5 | ~50 min |
| iOS | ~15-20 min | 4-5 | ~100 min |

**Conclusion** : Reste confortablement dans le tier gratuit.

---

## Étapes de migration (quand prêt)

### 1. Préparation
```bash
npm install @capacitor/core @capacitor/cli
npx cap init PronoHub com.pronohub.app
```

### 2. Ajout des plateformes
```bash
npx cap add android
npx cap add ios  # Nécessite Mac ou Codemagic pour build
```

### 3. Configuration Codemagic
- Connecter le repo GitHub
- Configurer les workflows Android/iOS
- Ajouter les certificats de signature

### 4. Soumission stores
- Créer compte Google Play Console (25€)
- Créer compte Apple Developer (99€/an)
- Préparer assets (icônes, screenshots, descriptions)
- Soumettre pour review

---

## Ressources

- [Documentation Capacitor](https://capacitorjs.com/docs)
- [Codemagic](https://codemagic.io/)
- [Google Play Console](https://play.google.com/console)
- [Apple Developer](https://developer.apple.com/)

---

*Dernière mise à jour : Novembre 2024*
