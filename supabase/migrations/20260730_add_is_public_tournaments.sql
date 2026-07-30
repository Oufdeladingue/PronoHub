-- Tournoi PUBLIC : créé par l'admin, découvrable et rejoignable par n'importe quel visiteur
-- (résout le cold-start). Capacité illimitée, rejoignable même en cours (logique applicative
-- dans app/api/tournaments/join qui bypasse statut/capacité/quota/notifs quand is_public).
ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tournaments_public
  ON public.tournaments (is_public, status)
  WHERE is_public = TRUE;

COMMENT ON COLUMN public.tournaments.is_public IS
  'Tournoi public officiel (créé par admin) : découvrable, rejoignable sans invitation, capacité illimitée.';
