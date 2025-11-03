-- Ajouter le paramètre pour la limite de tournois par utilisateur
INSERT INTO admin_settings (setting_key, setting_value)
VALUES ('max_tournaments_per_user', '3')
ON CONFLICT (setting_key)
DO UPDATE SET setting_value = '3';
