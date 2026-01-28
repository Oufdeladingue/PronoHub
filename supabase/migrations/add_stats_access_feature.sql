-- Migration: Add Stats Access Feature
-- Date: 2026-01-28
-- Description: Adds new purchase types for stats feature access (per-tournament and lifetime)

-- Index pour lookup rapide accès stats
CREATE INDEX IF NOT EXISTS idx_tournament_purchases_stats_access
ON public.tournament_purchases(user_id, purchase_type, status)
WHERE purchase_type IN ('stats_access_tournament', 'stats_access_lifetime');

-- Index pour forme équipes (optimise les queries sur les derniers matchs d'une équipe)
CREATE INDEX IF NOT EXISTS idx_imported_matches_team_form_home
ON public.imported_matches(competition_id, home_team_id, utc_date DESC)
WHERE status = 'FINISHED';

CREATE INDEX IF NOT EXISTS idx_imported_matches_team_form_away
ON public.imported_matches(competition_id, away_team_id, utc_date DESC)
WHERE status = 'FINISHED';

-- Pricing config pour les nouvelles options stats
INSERT INTO public.pricing_config (config_key, config_value, config_type, label, description, category, sort_order, is_active) VALUES
  ('stats_access_tournament_price', 1.99, 'price', 'Stats par tournoi', 'Accès aux statistiques pour un tournoi spécifique', 'features', 50, true),
  ('stats_access_lifetime_price', 5.99, 'price', 'Stats à vie', 'Accès aux statistiques pour tous les tournois (actuels et futurs)', 'features', 51, true)
ON CONFLICT (config_key) DO UPDATE SET
  config_value = EXCLUDED.config_value,
  label = EXCLUDED.label,
  description = EXCLUDED.description;
