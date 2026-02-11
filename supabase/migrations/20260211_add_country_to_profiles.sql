-- Migration: Ajout du pays de l'utilisateur
-- Détecté via géolocalisation IP à chaque mise à jour de last_seen_at

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country VARCHAR(2);

CREATE INDEX IF NOT EXISTS idx_profiles_country ON profiles(country);
