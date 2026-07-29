-- Intégration Discord : URL de webhook par tournoi pour auto-poster les événements
-- (lancement, arrivée d'un joueur, rappels, classement, fin). null = non connecté.
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS discord_webhook_url TEXT;

COMMENT ON COLUMN public.tournaments.discord_webhook_url IS
  'URL de webhook Discord pour publier automatiquement les événements du tournoi dans un salon. NULL = non connecté.';
