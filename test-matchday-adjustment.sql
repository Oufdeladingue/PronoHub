-- ================================================
-- SCRIPT DE TEST: Ajustement des journées
-- ================================================
-- Ce script permet de tester le système d'ajustement des journées
-- en modifiant un tournoi pour simuler le scénario problématique
-- ================================================

-- 1. Voir tous les tournois en attente avec leurs journées
SELECT
  id,
  name,
  slug,
  status,
  num_matchdays as tours_actuels,
  planned_matchdays as tours_prevus,
  competition_id,
  created_at
FROM tournaments
WHERE status = 'pending'
ORDER BY created_at DESC;

-- 2. Voir les infos de la compétition brésilienne
SELECT
  id,
  name,
  current_matchday as journee_actuelle,
  total_matchdays as total_journees,
  (total_matchdays - current_matchday) as journees_restantes
FROM competitions
WHERE name ILIKE '%brésil%' OR name ILIKE '%brazil%' OR code = 'BSA';

-- ================================================
-- MODIFICATION POUR TEST
-- ================================================
-- Remplacez 'YOUR_TOURNAMENT_ID' par l'ID de votre tournoi
-- et ajustez la valeur selon le test souhaité
-- ================================================

-- Exemple 1: Simuler 10 tours prévus alors qu'il n'en reste que 8
-- UPDATE tournaments
-- SET
--   planned_matchdays = 10,
--   num_matchdays = 10
-- WHERE id = 'YOUR_TOURNAMENT_ID';

-- Exemple 2: Simuler 15 tours prévus (scénario extrême)
-- UPDATE tournaments
-- SET
--   planned_matchdays = 15,
--   num_matchdays = 15
-- WHERE id = 'YOUR_TOURNAMENT_ID';

-- ================================================
-- VÉRIFICATION APRÈS TEST
-- ================================================
-- Après avoir démarré le tournoi, vérifiez les données :

-- SELECT
--   id,
--   name,
--   status,
--   planned_matchdays as tours_prevus,
--   actual_matchdays as tours_reels,
--   starting_matchday as journee_debut,
--   ending_matchday as journee_fin,
--   matchday_snapshot as snapshot_journees
-- FROM tournaments
-- WHERE id = 'YOUR_TOURNAMENT_ID';

-- ================================================
-- RÉINITIALISATION (si besoin de retester)
-- ================================================
-- Pour remettre le tournoi en attente et retester :

-- UPDATE tournaments
-- SET
--   status = 'pending',
--   start_date = NULL,
--   actual_matchdays = NULL,
--   starting_matchday = NULL,
--   ending_matchday = NULL,
--   matchday_snapshot = NULL
-- WHERE id = 'YOUR_TOURNAMENT_ID';
