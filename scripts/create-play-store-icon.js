const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createPlayStoreIcon() {
  const inputPath = path.join(__dirname, '../public/images/logo.png');
  const outputDir = path.join(__dirname, '../android/play-store-assets');
  const outputPath = path.join(outputDir, 'icon-512.png');

  // Créer le dossier s'il n'existe pas
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Lire l'image d'origine pour obtenir ses dimensions
    const metadata = await sharp(inputPath).metadata();
    console.log(`Image d'origine: ${metadata.width}x${metadata.height}`);

    // Créer une icône 512x512 avec fond noir
    await sharp(inputPath)
      .resize(512, 512, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 1 } // Fond noir
      })
      .png()
      .toFile(outputPath);

    console.log(`✅ Icône Play Store créée: ${outputPath}`);
    console.log('Dimensions: 512x512 pixels');
    console.log('Format: PNG avec fond noir');
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

createPlayStoreIcon();
