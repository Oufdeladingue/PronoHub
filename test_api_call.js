require('dotenv').config({ path: '.env.local' })

async function testAPICall() {
  try {
    console.log('=== TEST D\'APPEL À L\'API /api/user/trophies ===\n')

    // Simuler une requête GET avec un token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    console.log('URL Supabase:', supabaseUrl)
    console.log('API Key existe:', !!supabaseKey)

    console.log('\nPour tester l\'API, ouvrez votre navigateur et allez à:')
    console.log('http://localhost:3000/api/user/trophies')
    console.log('\nSi vous êtes connecté en tant que Rom\'s, l\'API devrait:')
    console.log('1. Détecter les trophées à débloquer')
    console.log('2. UNIQUEMENT créer les trophées valides selon la nouvelle logique')
    console.log('3. Ne PAS créer king_of_day ni double_king (car égalité à 0 points)')

    console.log('\nPour débugger, vérifiez les logs du serveur Next.js')

  } catch (error) {
    console.error('Erreur:', error)
  }
}

testAPICall()
