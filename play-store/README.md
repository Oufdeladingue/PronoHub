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

- [ ] Icône 512x512 créée
- [ ] Feature graphic 1024x500 créée
- [ ] Minimum 2 screenshots téléphone
- [ ] Description courte rédigée (80 car max)
- [ ] Description longue rédigée (4000 car max)
- [ ] Privacy Policy URL prête
- [ ] Content rating questionnaire rempli

## Outils recommandés

- **Mockups:** [Previewed.app](https://previewed.app), [AppMockUp](https://app-mockup.com)
- **Design:** [Figma](https://figma.com), [Canva](https://canva.com)
- **Templates:** [Hotpot.ai](https://hotpot.ai/templates/google_play_screenshot)

## Informations de l'app

- **Nom:** PronoHub
- **Package:** club.pronohub.app
- **Version:** 1.0 (versionCode 1)
- **Catégorie:** Sports
