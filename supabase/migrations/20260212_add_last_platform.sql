-- Ajouter le tracking de la plateforme de connexion (web ou android)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_platform TEXT DEFAULT 'web';
