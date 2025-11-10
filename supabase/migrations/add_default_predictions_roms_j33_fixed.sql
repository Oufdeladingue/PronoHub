-- ================================================
-- Script pour ajouter les pronostics par défaut
-- pour Rom's sur la journée 33 du tournoi BrazilTest
-- ================================================

-- 1. D'abord, ajouter la colonne is_default_prediction si elle n'existe pas
ALTER TABLE predictions
ADD COLUMN IF NOT EXISTS is_default_prediction BOOLEAN DEFAULT FALSE;

-- 2. Créer un index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_predictions_is_default
ON predictions(is_default_prediction);

-- 3. Ajouter un commentaire pour la documentation
COMMENT ON COLUMN predictions.is_default_prediction IS 'Indique si ce pronostic est un pronostic par défaut (0-0) non saisi par l''utilisateur. Les pronostics par défaut ne rapportent qu''1 point maximum en cas de match nul.';

-- 4. Créer les pronostics par défaut pour Rom's sur la journée 33
DO $$
DECLARE
  roms_user_id UUID;
  brazil_tournament_id UUID;
  competition_id_val INTEGER;
  match_record RECORD;
  existing_prediction_count INTEGER;
  created_count INTEGER := 0;
BEGIN
  -- Récupérer l'ID de l'utilisateur Rom's (avec apostrophe)
  SELECT id INTO roms_user_id
  FROM profiles
  WHERE username = 'Rom''s'
  LIMIT 1;

  IF roms_user_id IS NULL THEN
    RAISE NOTICE 'Utilisateur Rom''s non trouvé';
    RETURN;
  END IF;

  RAISE NOTICE 'ID utilisateur Rom''s: %', roms_user_id;

  -- Récupérer l'ID du tournoi BrazilTest
  SELECT id, competition_id INTO brazil_tournament_id, competition_id_val
  FROM tournaments
  WHERE name = 'BrazilTest'
  LIMIT 1;

  IF brazil_tournament_id IS NULL THEN
    RAISE NOTICE 'Tournoi BrazilTest non trouvé';
    RETURN;
  END IF;

  RAISE NOTICE 'ID tournoi BrazilTest: %', brazil_tournament_id;
  RAISE NOTICE 'Competition ID: %', competition_id_val;

  -- Pour chaque match de la journée 33
  FOR match_record IN
    SELECT id
    FROM imported_matches
    WHERE competition_id = competition_id_val
      AND matchday = 33
  LOOP
    -- Vérifier si un pronostic existe déjà pour ce match
    SELECT COUNT(*) INTO existing_prediction_count
    FROM predictions
    WHERE user_id = roms_user_id
      AND tournament_id = brazil_tournament_id
      AND match_id = match_record.id;

    -- Si aucun pronostic n'existe, créer un pronostic par défaut
    IF existing_prediction_count = 0 THEN
      INSERT INTO predictions (
        tournament_id,
        user_id,
        match_id,
        predicted_home_score,
        predicted_away_score,
        is_default_prediction
      )
      VALUES (
        brazil_tournament_id,
        roms_user_id,
        match_record.id,
        0,
        0,
        TRUE
      );

      created_count := created_count + 1;
      RAISE NOTICE 'Pronostic par défaut créé pour le match %', match_record.id;
    ELSE
      RAISE NOTICE 'Pronostic existant pour le match %, skip', match_record.id;
    END IF;
  END LOOP;

  RAISE NOTICE '=================================';
  RAISE NOTICE 'Création terminée: % pronostics par défaut créés', created_count;
  RAISE NOTICE '=================================';
END $$;

-- 5. Vérifier les résultats
SELECT
  p.username,
  t.name as tournament_name,
  COUNT(*) as total_predictions,
  SUM(CASE WHEN pr.is_default_prediction = TRUE THEN 1 ELSE 0 END) as default_predictions,
  SUM(CASE WHEN pr.is_default_prediction = FALSE OR pr.is_default_prediction IS NULL THEN 1 ELSE 0 END) as real_predictions
FROM predictions pr
JOIN profiles p ON p.id = pr.user_id
JOIN tournaments t ON t.id = pr.tournament_id
JOIN imported_matches im ON im.id = pr.match_id
WHERE p.username = 'Rom''s'
  AND t.name = 'BrazilTest'
  AND im.matchday = 33
GROUP BY p.username, t.name;
