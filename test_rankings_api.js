const fetch = require('node-fetch')

async function testRankingsAPI() {
  console.log('=== Test de l\'API de classement ===\n')

  try {
    const response = await fetch('http://localhost:3000/api/tournaments/0956fa4f-d661-436b-84f7-520015ffcf89/rankings')

    console.log('Status:', response.status)
    console.log('Status Text:', response.statusText)
    console.log()

    const data = await response.json()

    if (response.ok) {
      console.log('✓ API fonctionne correctement\n')
      console.log('Données retournées:')
      console.log(JSON.stringify(data, null, 2))
    } else {
      console.log('❌ Erreur de l\'API:')
      console.log(JSON.stringify(data, null, 2))
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'appel:', error.message)
  }
}

testRankingsAPI()
