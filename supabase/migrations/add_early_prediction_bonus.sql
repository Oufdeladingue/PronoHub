-- Add early_prediction_bonus column to tournaments table
-- This feature rewards players who complete all predictions at least 1 hour before the first match of a matchday

ALTER TABLE tournaments
ADD COLUMN IF NOT EXISTS early_prediction_bonus BOOLEAN DEFAULT false;

COMMENT ON COLUMN tournaments.early_prediction_bonus IS 'When enabled, players who predict all matches at least 1 hour before the first match of a matchday earn +1 bonus point';
