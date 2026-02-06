-- Mettre à jour les prix des extensions dans la table pricing_config

-- Prix des extensions (déjà existants, on les met à jour)
UPDATE pricing_config
SET config_value = 3.99
WHERE config_key = 'duration_extension_price';

UPDATE pricing_config
SET config_value = 1.99
WHERE config_key = 'player_extension_price';

UPDATE pricing_config
SET config_value = 2.99
WHERE config_key = 'stats_access_tournament_price';

UPDATE pricing_config
SET config_value = 5.99
WHERE config_key = 'stats_access_lifetime_price';

-- Si les entrées n'existent pas encore, les créer
INSERT INTO pricing_config (config_key, config_value, is_active, description)
SELECT 'duration_extension_price', 3.99, true, 'Prix de l''extension de durée (10 journées supplémentaires)'
WHERE NOT EXISTS (SELECT 1 FROM pricing_config WHERE config_key = 'duration_extension_price');

INSERT INTO pricing_config (config_key, config_value, is_active, description)
SELECT 'player_extension_price', 1.99, true, 'Prix de l''extension de capacité (+5 joueurs)'
WHERE NOT EXISTS (SELECT 1 FROM pricing_config WHERE config_key = 'player_extension_price');

INSERT INTO pricing_config (config_key, config_value, is_active, description)
SELECT 'stats_access_tournament_price', 2.99, true, 'Prix des stats pour un tournoi'
WHERE NOT EXISTS (SELECT 1 FROM pricing_config WHERE config_key = 'stats_access_tournament_price');

INSERT INTO pricing_config (config_key, config_value, is_active, description)
SELECT 'stats_access_lifetime_price', 5.99, true, 'Prix des stats à vie (tous les tournois)'
WHERE NOT EXISTS (SELECT 1 FROM pricing_config WHERE config_key = 'stats_access_lifetime_price');
