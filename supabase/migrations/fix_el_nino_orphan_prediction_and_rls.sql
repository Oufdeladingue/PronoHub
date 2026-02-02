-- Migration: Correction de l'incohérence El nino + Politique RLS predictions
-- Date: 2026-02-02

-- 1. Supprimer la prédiction orpheline d'El nino (pas participant du tournoi)
DELETE FROM predictions
WHERE user_id = '9f68369a-45c1-45e7-9498-26fe63764460'
  AND tournament_id = '47eeeb93-7616-4582-b7a4-f9d612eb9a0e';

-- 2. Supprimer le trophée 'correct_result' (Veinard) d'El nino
-- car il n'a plus de prédiction valide
DELETE FROM user_trophies
WHERE user_id = '9f68369a-45c1-45e7-9498-26fe63764460'
  AND trophy_type = 'correct_result';

-- 3. Corriger la politique RLS pour empêcher ce problème à l'avenir
-- Supprimer l'ancienne politique
DROP POLICY IF EXISTS "Users can create predictions" ON public.predictions;

-- Créer la nouvelle politique avec vérification de participation au tournoi
CREATE POLICY "Users can create predictions"
  ON public.predictions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM tournament_participants tp
      WHERE tp.tournament_id = predictions.tournament_id
        AND tp.user_id = auth.uid()
    )
  );

-- Commentaire pour documentation
COMMENT ON POLICY "Users can create predictions" ON public.predictions IS
  'Les utilisateurs peuvent créer des pronostics uniquement pour les tournois auxquels ils participent';
