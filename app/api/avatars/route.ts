import { NextResponse } from 'next/server'
import { readdir } from 'fs/promises'
import { join } from 'path'

export async function GET() {
  try {
    const avatarsDir = join(process.cwd(), 'public', 'avatars')
    const files = await readdir(avatarsDir)

    // Filtrer uniquement les fichiers .png et extraire les noms sans extension
    const avatars = files
      .filter(file => file.endsWith('.png'))
      .map(file => file.replace('.png', ''))
      .sort((a, b) => {
        // Trier numériquement si possible (avatar1, avatar2, etc.)
        const numA = parseInt(a.replace('avatar', ''))
        const numB = parseInt(b.replace('avatar', ''))
        if (!isNaN(numA) && !isNaN(numB)) {
          return numA - numB
        }
        return a.localeCompare(b)
      })

    return NextResponse.json({ avatars })
  } catch (error) {
    console.error('Error reading avatars directory:', error)
    // Fallback vers la liste par défaut en cas d'erreur
    return NextResponse.json({
      avatars: [
        'avatar1', 'avatar2', 'avatar3', 'avatar4',
        'avatar5', 'avatar6', 'avatar7', 'avatar8',
        'avatar9', 'avatar10', 'avatar11', 'avatar12'
      ]
    })
  }
}
