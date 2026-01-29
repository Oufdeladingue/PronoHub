-- Trouver le tournoi "Le Roi Merlin" et ses infos
SELECT 
  t.id,
  t.name,
  t.slug,
  t.starting_matchday,
  t.ending_matchday,
  t.custom_competition_id,
  cc.name as competition_name
FROM tournaments t
LEFT JOIN custom_competitions cc ON t.custom_competition_id = cc.id
WHERE t.name ILIKE '%merlin%' OR t.name ILIKE '%roi%'
ORDER BY t.created_at DESC
LIMIT 5;
