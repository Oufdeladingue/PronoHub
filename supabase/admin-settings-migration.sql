-- Migration pour ajouter la table admin_settings
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Table pour stocker les paramètres d'administration
CREATE TABLE IF NOT EXISTS public.admin_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour améliorer les performances de recherche par clé
CREATE INDEX IF NOT EXISTS idx_admin_settings_key ON public.admin_settings(setting_key);

-- Trigger pour mettre à jour updated_at automatiquement
CREATE TRIGGER update_admin_settings_updated_at
  BEFORE UPDATE ON public.admin_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Insérer les valeurs par défaut pour le rafraîchissement automatique
INSERT INTO public.admin_settings (setting_key, setting_value, description) VALUES
  ('auto_refresh_enabled', 'true', 'Activer le rafraîchissement automatique des résultats de matchs'),
  ('auto_refresh_interval', '300000', 'Intervalle de rafraîchissement en millisecondes (5 minutes par défaut)'),
  ('auto_refresh_smart_mode', 'true', 'Mode intelligent: rafraîchir plus souvent pendant les matchs en cours'),
  ('auto_refresh_pause_inactive', 'true', 'Mettre en pause le rafraîchissement quand l''onglet est inactif')
ON CONFLICT (setting_key) DO NOTHING;

-- Politiques RLS (Row Level Security)
ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les paramètres (nécessaire pour l'application)
CREATE POLICY "Settings are viewable by everyone"
  ON public.admin_settings FOR SELECT
  USING (true);

-- Seuls les super admins peuvent modifier les paramètres
-- Note: Vous devrez adapter cette politique selon votre logique d'authentification
CREATE POLICY "Only super admins can update settings"
  ON public.admin_settings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Only super admins can insert settings"
  ON public.admin_settings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

CREATE POLICY "Only super admins can delete settings"
  ON public.admin_settings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );
