-- Ajouter le flag d'onboarding welcome pour les nouveaux utilisateurs
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_seen_welcome BOOLEAN DEFAULT false;

-- Marquer tous les utilisateurs existants comme ayant déjà vu le welcome
UPDATE profiles SET has_seen_welcome = true WHERE has_chosen_username = true;
