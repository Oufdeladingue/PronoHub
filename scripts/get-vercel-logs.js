#!/usr/bin/env node

/**
 * Script pour récupérer les logs Vercel du cron send-reminders
 * Usage: node scripts/get-vercel-logs.js
 *
 * Nécessite: VERCEL_TOKEN dans .env.local
 */

const https = require('https')

const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const PROJECT_NAME = 'pronohub' // ou l'ID du projet Vercel
const TEAM_ID = process.env.VERCEL_TEAM_ID // optionnel

if (!VERCEL_TOKEN) {
  console.error('❌ VERCEL_TOKEN manquant dans .env.local')
  console.error('Récupère ton token sur: https://vercel.com/account/tokens')
  process.exit(1)
}

// Construire l'URL de l'API Vercel
let url = `/v2/deployments?projectId=${PROJECT_NAME}&limit=1`
if (TEAM_ID) {
  url += `&teamId=${TEAM_ID}`
}

const options = {
  hostname: 'api.vercel.com',
  path: url,
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${VERCEL_TOKEN}`
  }
}

console.log('🔍 Récupération du dernier déploiement...')

https.get(options, (res) => {
  let data = ''

  res.on('data', (chunk) => {
    data += chunk
  })

  res.on('end', () => {
    try {
      const result = JSON.parse(data)

      if (result.error) {
        console.error('❌ Erreur API:', result.error.message)
        return
      }

      if (!result.deployments || result.deployments.length === 0) {
        console.error('❌ Aucun déploiement trouvé')
        return
      }

      const deployment = result.deployments[0]
      console.log('✅ Dernier déploiement:', deployment.url)
      console.log('📅 Date:', new Date(deployment.created).toLocaleString('fr-FR'))

      // Maintenant récupérer les logs de ce déploiement
      const logsUrl = `/v2/deployments/${deployment.uid}/events?limit=100`

      const logsOptions = {
        hostname: 'api.vercel.com',
        path: TEAM_ID ? `${logsUrl}&teamId=${TEAM_ID}` : logsUrl,
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${VERCEL_TOKEN}`
        }
      }

      console.log('\n🔍 Récupération des logs...\n')

      https.get(logsOptions, (logRes) => {
        let logData = ''

        logRes.on('data', (chunk) => {
          logData += chunk
        })

        logRes.on('end', () => {
          try {
            const logs = JSON.parse(logData)

            // Filtrer les logs du cron send-reminders
            const cronLogs = logs.filter(log =>
              log.text && log.text.includes('send-reminders')
            )

            if (cronLogs.length === 0) {
              console.log('ℹ️  Aucun log de cron trouvé')
              console.log('💡 Pour voir tous les logs, va sur: https://vercel.com/dashboard')
            } else {
              console.log(`📋 ${cronLogs.length} logs de cron trouvés:\n`)
              cronLogs.forEach(log => {
                const date = new Date(log.created).toLocaleString('fr-FR')
                console.log(`[${date}] ${log.text}`)
              })
            }
          } catch (err) {
            console.error('❌ Erreur parsing logs:', err.message)
          }
        })
      }).on('error', (err) => {
        console.error('❌ Erreur récupération logs:', err.message)
      })

    } catch (err) {
      console.error('❌ Erreur parsing:', err.message)
    }
  })
}).on('error', (err) => {
  console.error('❌ Erreur requête:', err.message)
})
