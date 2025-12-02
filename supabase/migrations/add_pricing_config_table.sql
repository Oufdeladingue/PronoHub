-- =====================================================
-- MIGRATION: Table de configuration des prix
-- Date: 2025-12-02
-- =====================================================
-- Permet de gerer les prix dynamiquement depuis l'admin
-- =====================================================

-- 1. Creer la table pricing_config
CREATE TABLE IF NOT EXISTS public.pricing_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  config_key TEXT UNIQUE NOT NULL,
  config_value DECIMAL(10,2) NOT NULL,
  config_type TEXT NOT NULL DEFAULT 'price', -- price, limit, percentage
  label TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL, -- tournament_creation, extensions, limits, platinium
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Inserer les valeurs par defaut

-- Prix de creation des tournois
INSERT INTO public.pricing_config (config_key, config_value, config_type, label, description, category, sort_order) VALUES
  ('oneshot_creation_price', 4.99, 'price', 'Creation One-Shot', 'Prix pour creer un tournoi One-Shot (max 10 joueurs)', 'tournament_creation', 1),
  ('elite_creation_price', 9.99, 'price', 'Creation Elite Team', 'Prix pour creer un tournoi Elite Team (max 20 joueurs)', 'tournament_creation', 2),
  ('platinium_creation_price', 6.99, 'price', 'Creation/Participation Platinium', 'Prix par personne pour Platinium (11-30 joueurs)', 'tournament_creation', 3)
ON CONFLICT (config_key) DO NOTHING;

-- Extensions Free-Kick
INSERT INTO public.pricing_config (config_key, config_value, config_type, label, description, category, sort_order) VALUES
  ('slot_invite_price', 0.99, 'price', 'Slot invite supplementaire', 'Prix pour rejoindre un 3eme tournoi gratuit', 'extensions', 1),
  ('duration_extension_price', 3.99, 'price', 'Extension duree', 'Prolonger un tournoi Free jusqu''a la fin de la competition', 'extensions', 2),
  ('player_extension_price', 1.99, 'price', 'Extension joueurs (+5)', 'Ajouter 5 places supplementaires a un tournoi Free', 'extensions', 3)
ON CONFLICT (config_key) DO NOTHING;

-- Limites des tournois
INSERT INTO public.pricing_config (config_key, config_value, config_type, label, description, category, sort_order) VALUES
  ('free_max_players', 5, 'limit', 'Max joueurs Free-Kick', 'Nombre maximum de joueurs pour un tournoi gratuit', 'limits', 1),
  ('free_max_matchdays', 10, 'limit', 'Max journees Free-Kick', 'Nombre maximum de journees pour un tournoi gratuit', 'limits', 2),
  ('free_max_tournaments', 2, 'limit', 'Max tournois Free actifs', 'Nombre maximum de tournois gratuits actifs par utilisateur', 'limits', 3),
  ('oneshot_max_players', 10, 'limit', 'Max joueurs One-Shot', 'Nombre maximum de joueurs pour un tournoi One-Shot', 'limits', 4),
  ('elite_max_players', 20, 'limit', 'Max joueurs Elite Team', 'Nombre maximum de joueurs pour un tournoi Elite Team', 'limits', 5),
  ('platinium_min_players', 11, 'limit', 'Min joueurs Platinium', 'Nombre minimum de joueurs pour demarrer un Platinium', 'limits', 6),
  ('platinium_max_players', 30, 'limit', 'Max joueurs Platinium', 'Nombre maximum de joueurs pour un tournoi Platinium', 'limits', 7),
  ('player_extension_amount', 5, 'limit', 'Joueurs par extension', 'Nombre de joueurs ajoutes par extension', 'limits', 8)
ON CONFLICT (config_key) DO NOTHING;

-- Options Platinium
INSERT INTO public.pricing_config (config_key, config_value, config_type, label, description, category, sort_order) VALUES
  ('platinium_group_size', 11, 'limit', 'Taille groupe Platinium', 'Nombre de places incluses dans l''achat groupe', 'platinium', 1),
  ('platinium_group_discount', 0, 'percentage', 'Remise groupe Platinium', 'Pourcentage de remise pour achat groupe (0 = pas de remise)', 'platinium', 2)
ON CONFLICT (config_key) DO NOTHING;

-- 3. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_pricing_config_key ON public.pricing_config(config_key);
CREATE INDEX IF NOT EXISTS idx_pricing_config_category ON public.pricing_config(category);

-- 4. RLS
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les prix (pour l'affichage)
CREATE POLICY "Anyone can read pricing config"
  ON public.pricing_config FOR SELECT
  USING (true);

-- Seuls les super_admin peuvent modifier
CREATE POLICY "Super admins can update pricing config"
  ON public.pricing_config FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 5. Fonction pour obtenir un prix
CREATE OR REPLACE FUNCTION public.get_price(p_config_key TEXT)
RETURNS DECIMAL(10,2) AS $$
  SELECT config_value FROM public.pricing_config
  WHERE config_key = p_config_key AND is_active = TRUE
  LIMIT 1;
$$ LANGUAGE SQL STABLE;

-- 6. Vue pour faciliter l'acces aux prix
CREATE OR REPLACE VIEW public.current_prices AS
SELECT
  config_key,
  config_value,
  config_type,
  label,
  category
FROM public.pricing_config
WHERE is_active = TRUE
ORDER BY category, sort_order;

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
