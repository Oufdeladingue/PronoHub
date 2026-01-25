#!/usr/bin/env node

/**
 * Script pour récupérer les logs du cron send-reminders via API Vercel
 * Usage: node scripts/get-cron-logs.js
 */

const https = require('https')

// Récupérer le token depuis les variables d'environnement ou invite utilisateur
const VERCEL_TOKEN = process.env.VERCEL_TOKEN
const PROJECT_NAME = 'pronohub'
const TEAM_ID = process.env.VERCEL_TEAM_ID

if (!VERCEL_TOKEN) {
  console.error('❌ VERCEL_TOKEN manquant')
  console.error('\nPour obtenir un token:')
  console.error('1. Va sur https://vercel.com/account/tokens')
  console.error('2. Clique "Create Token"')
  console.error('3. Copie le token')
  console.error('4. Ajoute-le dans .env.local: VERCEL_TOKEN=ton_token')
  console.error('\nOu exécute: VERCEL_TOKEN=ton_token node scripts/get-cron-logs.js')
  process.exit(1)
}

async function getProjectId() {
  return new Promise((resolve, reject) => {
    let url = '/v9/projects/' + PROJECT_NAME
    if (TEAM_ID) url += '?teamId=' + TEAM_ID

    const options = {
      hostname: 'api.vercel.com',
      path: url,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
    }

    https.get(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.error) {
            reject(new Error(result.error.message))
          } else {
            resolve(result.id)
          }
        } catch (err) {
          reject(err)
        }
      })
    }).on('error', reject)
  })
}

async function getDeployments(projectId) {
  return new Promise((resolve, reject) => {
    let url = `/v6/deployments?projectId=${projectId}&limit=10`
    if (TEAM_ID) url += `&teamId=${TEAM_ID}`

    const options = {
      hostname: 'api.vercel.com',
      path: url,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
    }

    https.get(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          if (result.error) {
            reject(new Error(result.error.message))
          } else {
            resolve(result.deployments || [])
          }
        } catch (err) {
          reject(err)
        }
      })
    }).on('error', reject)
  })
}

async function getDeploymentLogs(deploymentId) {
  return new Promise((resolve, reject) => {
    let url = `/v2/deployments/${deploymentId}/events?limit=1000`
    if (TEAM_ID) url += `&teamId=${TEAM_ID}`

    const options = {
      hostname: 'api.vercel.com',
      path: url,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${VERCEL_TOKEN}` }
    }

    https.get(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          resolve(result || [])
        } catch (err) {
          reject(err)
        }
      })
    }).on('error', reject)
  })
}

async function main() {
  try {
    console.log('🔍 Récupération des informations du projet...\n')

    const projectId = await getProjectId()
    console.log(`✅ Projet: ${PROJECT_NAME} (ID: ${projectId})\n`)

    console.log('📦 Récupération des déploiements...\n')
    const deployments = await getDeployments(projectId)

    if (deployments.length === 0) {
      console.log('❌ Aucun déploiement trouvé')
      return
    }

    const latestDeployment = deployments[0]
    console.log(`✅ Dernier déploiement: ${latestDeployment.url}`)
    console.log(`📅 Date: ${new Date(latestDeployment.created).toLocaleString('fr-FR')}\n`)

    console.log('📋 Récupération des logs...\n')
    const logs = await getDeploymentLogs(latestDeployment.uid)

    // Filtrer les logs du cron send-reminders
    const cronLogs = logs.filter(log => {
      const text = log.text || ''
      return text.includes('send-reminders') ||
             text.includes('CRON') ||
             text.includes('reminder') ||
             text.includes('/api/cron/')
    })

    if (cronLogs.length === 0) {
      console.log('⚠️  Aucun log de cron send-reminders trouvé dans le dernier déploiement')
      console.log('\n💡 Pour voir tous les logs, va sur:')
      console.log(`   https://vercel.com/dashboard → ${PROJECT_NAME} → Logs\n`)
      return
    }

    console.log(`✅ ${cronLogs.length} logs de cron trouvés:\n`)
    console.log('═'.repeat(80))

    cronLogs.forEach(log => {
      const date = new Date(log.created || log.timestamp).toLocaleString('fr-FR', {
        timeZone: 'Europe/Paris',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      })
      console.log(`\n[${date}]`)
      console.log(log.text || log.message || JSON.stringify(log))
    })

    console.log('\n' + '═'.repeat(80))
    console.log('\n💡 Pour plus de détails, consulte le dashboard Vercel')

  } catch (error) {
    console.error('❌ Erreur:', error.message)
    process.exit(1)
  }
}

main()
