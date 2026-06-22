/**
 * Hook Next.js exécuté UNE fois au démarrage du serveur (instrumentation).
 *
 * On démarre ici une BOUCLE INTERNE qui appelle football-data toutes les 30 s pour mettre à jour
 * les scores live + finaliser les matchs terminés. Le serveur Next tourne en permanence dans le
 * conteneur Coolify → la boucle tourne en permanence aussi. AUCUN cron, AUCUN pg_net, AUCUN
 * service externe : c'est le poller principal, simple et fiable.
 */
export async function register() {
  // Uniquement côté serveur Node, en PRODUCTION, et une seule fois (anti double-démarrage HMR).
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NODE_ENV !== 'production') return
  if ((globalThis as any).__livePollStarted) return
  ;(globalThis as any).__livePollStarted = true

  const { runLivePoll } = await import('@/lib/live-poll-core')

  const tick = async () => {
    try {
      const r = await runLivePoll()
      if (r.updated || r.finalized) {
        console.log(`[live-poll] ${r.updated} MAJ, ${r.finalized} finalisé(s) (${r.live} live)`)
      } else if (!r.ok) {
        console.warn(`[live-poll] passe ignorée: ${r.skipped || r.errors.join(',')}`)
      }
    } catch (e: any) {
      console.error('[live-poll] erreur:', e?.message || e)
    }
  }

  console.log('[live-poll] boucle interne démarrée — football-data toutes les 30 s')
  tick() // premier passage immédiat
  setInterval(tick, 30_000)
}
