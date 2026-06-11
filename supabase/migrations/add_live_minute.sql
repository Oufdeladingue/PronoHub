-- Minute de jeu en direct (depuis API-Football fixture.status.elapsed)
-- Affichée dans le badge "En direct" pendant les matchs de Coupe du Monde.
ALTER TABLE imported_matches ADD COLUMN IF NOT EXISTS live_minute integer;
