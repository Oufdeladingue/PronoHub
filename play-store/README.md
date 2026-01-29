# Assets Play Store - PronoHub

Ce dossier contient tous les éléments nécessaires pour la publication sur Google Play Store.

## Structure

```
play-store/
├── graphics/           # Images promotionnelles
│   ├── icon-512.png   # Icône haute résolution (512x512)
│   └── feature-graphic.png  # Bannière (1024x500)
├── screenshots/        # Captures d'écran
│   ├── phone/         # Téléphone (1080x1920 ou 16:9)
│   └── tablet/        # Tablette (optionnel)
└── texts/             # Textes de la fiche
    ├── description-short.txt   # Description courte (80 car)
    └── description-long.txt    # Description longue (4000 car)
```

## Spécifications des images

### Icône Hi-res (OBLIGATOIRE)
- **Fichier:** `graphics/icon-512.png`
- **Taille:** 512 x 512 px
- **Format:** PNG (32 bits, avec alpha)
- **Note:** Doit correspondre à l'icône de l'app

### Feature Graphic (OBLIGATOIRE)
- **Fichier:** `graphics/feature-graphic.png`
- **Taille:** 1024 x 500 px
- **Format:** PNG ou JPG
- **Note:** Bannière affichée en haut de la fiche Play Store

### Screenshots téléphone (OBLIGATOIRE - min 2, max 8)
- **Dossier:** `screenshots/phone/`
- **Taille:** 1080 x 1920 px (ou ratio 16:9)
- **Format:** PNG ou JPG
- **Nommage:** `01-accueil.png`, `02-pronostics.png`, etc.

### Screenshots tablette (OPTIONNEL)
- **Dossier:** `screenshots/tablet/`
- **Taille 7":** 1080 x 1920 px
- **Taille 10":** 1920 x 1200 px

## Checklist avant publication

- [x] Icône 512x512 créée ✅
- [x] Feature graphic 1024x500 créée ✅
- [x] Minimum 2 screenshots téléphone (5 faits) ✅
- [x] Description courte rédigée (80 car max) ✅
- [x] Description longue rédigée (4000 car max) ✅
- [ ] Privacy Policy URL prête
- [ ] Content rating questionnaire rempli

---

## 🚀 PROCHAINES ÉTAPES (Publication Play Store)

### 1. Générer l'AAB signé
```bash
cd android
./gradlew bundleRelease
```
Le fichier sera dans : `android/app/build/outputs/bundle/release/app-release.aab`

### 2. Créer la fiche sur Google Play Console
1. Aller sur https://play.google.com/console
2. Créer une application > Android
3. Remplir les infos de base :
   - Nom : **PronoHub**
   - Langue par défaut : **Français**

### 3. Configurer la fiche Store
- **Description courte** : copier depuis `texts/description-short.txt`
- **Description longue** : copier depuis `texts/description-long.txt`
- **Icône** : uploader `graphics/icon-512.png`
- **Feature graphic** : uploader `graphics/feature-graphic.png`
- **Screenshots** : uploader les 5 images de `screenshots/phone/`

### 4. Remplir les sections obligatoires
- **Catégorie** : Sports
- **Coordonnées** : Email de contact
- **Privacy Policy** : URL de ta politique de confidentialité
  - Si pas encore créée, utiliser https://www.pronohub.club/privacy
- **Content rating** : Remplir le questionnaire (quelques minutes)
- **Target audience** : 18+ (paris/pronostics)
- **Ads** : Non (pas de pubs)

### 5. Uploader l'AAB
- Section "Production" > "Créer une release"
- Uploader le fichier `app-release.aab`
- Notes de version : "Première version de PronoHub"

### 6. Soumettre pour review
- Vérifier que tout est vert dans la checklist Play Console
- Soumettre pour examen (1-7 jours généralement)

---

## ⚠️ Points d'attention

1. **Compte développeur Google** : 25$ one-time fee si pas déjà fait
2. **Privacy Policy** : Obligatoire, doit être accessible publiquement
3. **Keystore** : Ne JAMAIS perdre le keystore, sinon impossible de mettre à jour l'app

## Outils recommandés

- **Mockups:** [Previewed.app](https://previewed.app), [AppMockUp](https://app-mockup.com)
- **Design:** [Figma](https://figma.com), [Canva](https://canva.com)
- **Templates:** [Hotpot.ai](https://hotpot.ai/templates/google_play_screenshot)

## Informations de l'app

- **Nom:** PronoHub
- **Package:** club.pronohub.app
- **Version:** 1.0 (versionCode 1)
- **Catégorie:** Sports
