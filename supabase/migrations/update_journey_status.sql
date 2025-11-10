-- ================================================
-- Mise à jour manuelle du statut des journées
-- ================================================
-- À exécuter dans: Supabase Dashboard > SQL Editor
-- ================================================

-- Pour BrazilTest : Marquer la journée 1 comme terminée
-- Remplacez 'BrazilTest' par le nom exact de votre tournoi si différent

UPDATE tournament_journeys
SET
  status = 'completed',
  completed_at = NOW()
WHERE journey_number = 1
  AND tournament_id IN (
    SELECT id FROM tournaments WHERE name = 'BrazilTest'
  );

-- Vérifier le résultat
SELECT
  t.name as tournament_name,
  tj.journey_number,
  tj.status,
  tj.completed_at,
  tj.started_at
FROM tournament_journeys tj
JOIN tournaments t ON t.id = tj.tournament_id
WHERE t.name IN ('BrazilTest', 'HollandeTest')
ORDER BY t.name, tj.journey_number;
