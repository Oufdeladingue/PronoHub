-- =====================================================
-- MIGRATION: Index de performance
-- Date: 2025-01-21
-- =====================================================
-- Ces index améliorent les performances des requêtes
-- les plus fréquentes de l'application
-- =====================================================

-- 1. Index pour les participants de tournoi
-- Utilisé dans: join, rankings, dashboard
-- Optimise les recherches par (tournament_id, user_id)
CREATE INDEX IF NOT EXISTS idx_tournament_participants_tournament_user
ON tournament_participants(tournament_id, user_id);

-- 2. Index pour les achats/slots utilisateur
-- Utilisé dans: join (vérification des slots disponibles)
-- Optimise les recherches par (user_id, purchase_type, used, status)
CREATE INDEX IF NOT EXISTS idx_tournament_purchases_user_type_used
ON tournament_purchases(user_id, purchase_type, used, status);

-- 3. Index pour les demandes d'équipe
-- Utilisé dans: dashboard, échauffement
-- Optimise les recherches par (tournament_id, status)
CREATE INDEX IF NOT EXISTS idx_team_requests_tournament_status
ON team_requests(tournament_id, status);

-- 4. Index pour les prédictions
-- Utilisé dans: rankings, opposition
-- Optimise les recherches par (tournament_id, match_id, user_id)
CREATE INDEX IF NOT EXISTS idx_predictions_tournament_match
ON predictions(tournament_id, match_id);

CREATE INDEX IF NOT EXISTS idx_predictions_tournament_user
ON predictions(tournament_id, user_id);

-- 5. Index pour les matchs importés
-- Utilisé dans: dashboard, rankings, opposition
-- Optimise les recherches par (competition_id, matchday, status)
CREATE INDEX IF NOT EXISTS idx_imported_matches_competition_matchday
ON imported_matches(competition_id, matchday);

CREATE INDEX IF NOT EXISTS idx_imported_matches_competition_status
ON imported_matches(competition_id, status);

-- 6. Index pour les tournois
-- Utilisé dans: dashboard, join
-- Optimise les recherches par invite_code et slug
CREATE INDEX IF NOT EXISTS idx_tournaments_invite_code
ON tournaments(invite_code);

CREATE INDEX IF NOT EXISTS idx_tournaments_slug
ON tournaments(slug);

CREATE INDEX IF NOT EXISTS idx_tournaments_creator_status
ON tournaments(creator_id, status);

-- 7. Index pour les matchdays custom
-- Utilisé dans: rankings, opposition (tournois Best of Week)
CREATE INDEX IF NOT EXISTS idx_custom_matchdays_competition
ON custom_competition_matchdays(custom_competition_id, matchday_number);

CREATE INDEX IF NOT EXISTS idx_custom_matches_matchday
ON custom_competition_matches(custom_matchday_id);

-- 8. Index pour les matchs importés - football_data_match_id
-- Utilisé dans: opposition, rankings, bonus-matches (jointure custom_competition_matches → imported_matches)
-- Critique pour les tournois custom (6+ requêtes utilisent ce champ)
CREATE INDEX IF NOT EXISTS idx_imported_matches_football_data_match_id
ON imported_matches(football_data_match_id);

-- 9. Index pour les matchs importés - filtre par status + date
-- Utilisé dans: send-reminders (cron), notifications
CREATE INDEX IF NOT EXISTS idx_imported_matches_competition_matchday_finished
ON imported_matches(competition_id, matchday, finished);

-- 10. Index pour les abonnements
-- Utilisé dans: dashboard
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_status
ON user_subscriptions(user_id, status);

-- 11. Index pour les profils (utile pour les jointures)
CREATE INDEX IF NOT EXISTS idx_profiles_username
ON profiles(username);

-- =====================================================
-- Notes d'application:
-- - Exécuter ce script dans l'éditeur SQL de Supabase
-- - Les index IF NOT EXISTS évitent les erreurs si déjà présents
-- - Surveiller les performances après application
-- =====================================================
