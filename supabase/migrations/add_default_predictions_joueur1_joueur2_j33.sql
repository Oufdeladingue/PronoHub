-- ================================================
-- Script pour ajouter les pronostics par défaut
-- pour joueur1 et joueur2 sur la journée 33 du tournoi BrazilTest
-- ================================================

-- Créer les pronostics par défaut pour joueur1 et joueur2 sur la journée 33
DO $$
DECLARE
  user_record RECORD;
  brazil_tournament_id UUID;
  competition_id_val INTEGER;
  match_record RECORD;
  existing_prediction_count INTEGER;
  total_created_count INTEGER := 0;
  user_created_count INTEGER;
BEGIN
  -- Récupérer l'ID du tournoi BrazilTest
  SELECT id, competition_id INTO brazil_tournament_id, competition_id_val
  FROM tournaments
  WHERE name = 'BrazilTest'
  LIMIT 1;

  IF brazil_tournament_id IS NULL THEN
    RAISE NOTICE 'Tournoi BrazilTest non trouvé';
    RETURN;
  END IF;

  RAISE NOTICE '=================================';
  RAISE NOTICE 'ID tournoi BrazilTest: %', brazil_tournament_id;
  RAISE NOTICE 'Competition ID: %', competition_id_val;
  RAISE NOTICE '=================================';

  -- Boucle pour chaque utilisateur (joueur1 et joueur2)
  FOR user_record IN
    SELECT id, username
    FROM profiles
    WHERE username IN ('joueur1', 'joueur2')
  LOOP
    RAISE NOTICE '';
    RAISE NOTICE 'Traitement de l''utilisateur: %', user_record.username;
    RAISE NOTICE 'ID utilisateur: %', user_record.id;

    user_created_count := 0;

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
      WHERE user_id = user_record.id
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
          user_record.id,
          match_record.id,
          0,
          0,
          TRUE
        );

        user_created_count := user_created_count + 1;
        RAISE NOTICE '  ✓ Pronostic par défaut créé pour le match %', match_record.id;
      ELSE
        RAISE NOTICE '  - Pronostic existant pour le match %, skip', match_record.id;
      END IF;
    END LOOP;

    total_created_count := total_created_count + user_created_count;
    RAISE NOTICE 'Total pour %: % pronostics par défaut créés', user_record.username, user_created_count;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=================================';
  RAISE NOTICE 'Création terminée pour tous les utilisateurs';
  RAISE NOTICE 'Total général: % pronostics par défaut créés', total_created_count;
  RAISE NOTICE '=================================';
END $$;

-- Vérifier les résultats pour les deux joueurs
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
WHERE p.username IN ('joueur1', 'joueur2')
  AND t.name = 'BrazilTest'
  AND im.matchday = 33
GROUP BY p.username, t.name
ORDER BY p.username;
