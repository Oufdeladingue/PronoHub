/**
 * Hook Next.js exécuté UNE fois au démarrage du serveur (instrumentation).
 *
 * On démarre ici une BOUCLE INTERNE qui appelle football-data toutes les 30 s pour mettre à jour
 * les scores live + finaliser les matchs terminés. Le serveur Next tourne en permanence dans le
 * conteneur Coolify → la boucle tourne en permanence aussi. AUCUN cron, AUCUN pg_net, AUCUN
 * service externe : c'est le poller principal, simple et fiable.
 *
 * Les logs sont volontairement bavards pour qu'on voie dans Coolify exactement ce qui se passe.
 */
export async function register() {
  const runtime = process.env.NEXT_RUNTIME
  const env = process.env.NODE_ENV
  // Trace de démarrage TOUJOURS visible (diagnostic) : si on ne la voit pas dans les logs,
  // c'est que register() lui-même n'est pas appelé (build qui n'inclut pas instrumentation).
  console.log(`[live-poll] register() appelé — NEXT_RUNTIME=${runtime} NODE_ENV=${env}`)

  if (runtime !== 'nodejs') {
    console.log('[live-poll] skip — runtime non-nodejs')
    return
  }
  // On ne saute QUE si on est explicitement en dev local (évite de poller la prod depuis une machine
  // de dev). Si NODE_ENV est absent/mal défini dans le conteneur, on démarre quand même.
  if (env === 'development') {
    console.log('[live-poll] skip — NODE_ENV=development (dev local)')
    return
  }
  if ((globalThis as any).__livePollStarted) {
    console.log('[live-poll] skip — boucle déjà démarrée')
    return
  }
  ;(globalThis as any).__livePollStarted = true

  let runLivePoll: typeof import('./lib/live-poll-core').runLivePoll
  try {
    ;({ runLivePoll } = await import('./lib/live-poll-core'))
  } catch (e: any) {
    console.error('[live-poll] ÉCHEC import live-poll-core:', e?.message || e)
    ;(globalThis as any).__livePollStarted = false
    return
  }

  let running = false
  const tick = async () => {
    if (running) return // anti-chevauchement : un tick lent ne déclenche pas d'empilement
    running = true
    try {
      const r = await runLivePoll()
      if (r.updated || r.finalized || r.backfilled) {
        console.log(`[live-poll] ${r.updated} MAJ, ${r.finalized} finalisé(s), ${r.backfilled || 0} vainqueur(s) rattrapé(s) (${r.live} live)`)
      }
    } catch (e: any) {
      console.error('[live-poll] erreur tick:', e?.message || e)
    } finally {
      running = false
    }
  }

  console.log('[live-poll] ✅ boucle interne démarrée — football-data toutes les 30 s')
  tick() // premier passage immédiat
  setInterval(tick, 30_000)
}
