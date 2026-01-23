-- Migration: Ajouter le tracking des emails de relance pour utilisateurs inactifs
-- Date: 2026-01-23

-- Colonne pour tracker la date d'envoi de l'email de relance "utilisateur inactif"
-- (envoyé aux utilisateurs qui n'ont pas rejoint de tournoi après 10 jours)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS inactive_reminder_sent_at TIMESTAMPTZ;

-- Index pour optimiser la requête de recherche des utilisateurs à relancer
CREATE INDEX IF NOT EXISTS idx_profiles_inactive_reminder
ON profiles (created_at, inactive_reminder_sent_at)
WHERE inactive_reminder_sent_at IS NULL;

-- Commentaire pour documentation
COMMENT ON COLUMN profiles.inactive_reminder_sent_at IS 'Date d''envoi de l''email de relance pour utilisateur inactif (sans tournoi après 10 jours)';
