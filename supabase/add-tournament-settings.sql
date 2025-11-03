-- Ajouter les paramètres des tournois s'ils n'existent pas déjà

INSERT INTO admin_settings (setting_key, setting_value, description)
VALUES
  ('free_tier_max_players', '10', 'Nombre maximum de joueurs pour un tournoi en version gratuite'),
  ('points_exact_score', '3', 'Points attribués pour un score exact'),
  ('points_correct_result', '1', 'Points attribués pour le bon résultat (victoire/nul/défaite)')
ON CONFLICT (setting_key) DO NOTHING;
