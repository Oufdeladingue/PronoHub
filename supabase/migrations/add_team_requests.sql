-- =====================================================
-- MIGRATION: Système de demandes d'équipe pour tournois
-- Date: 2025-12-09
-- =====================================================
-- Permet aux joueurs de :
-- 1. Postuler pour rejoindre une équipe existante
-- 2. Suggérer la création d'une nouvelle équipe
-- Le capitaine peut approuver, modifier ou refuser les demandes
-- =====================================================

-- 1. Table des demandes d'équipe
CREATE TABLE IF NOT EXISTS public.team_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Type de demande: 'join' = postuler à une équipe, 'suggest' = suggérer une nouvelle équipe
  request_type VARCHAR(20) NOT NULL CHECK (request_type IN ('join', 'suggest')),

  -- Pour request_type = 'join': l'équipe ciblée
  target_team_id UUID REFERENCES public.tournament_teams(id) ON DELETE CASCADE,

  -- Pour request_type = 'suggest': détails de l'équipe suggérée
  suggested_team_name VARCHAR(15),
  suggested_team_avatar VARCHAR(50),

  -- Statut de la demande
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),

  -- Message optionnel du joueur
  message TEXT,

  -- Réponse du capitaine (si modifiée ou rejetée)
  captain_response TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,

  -- Contraintes
  -- Un joueur ne peut avoir qu'une seule demande en cours par tournoi
  CONSTRAINT one_pending_request_per_user UNIQUE (tournament_id, user_id) WHERE (status = 'pending')
);

-- Note: La contrainte unique conditionnelle ci-dessus n'est pas supportée en standard
-- On utilise un index unique partiel à la place
DROP INDEX IF EXISTS idx_team_requests_one_pending;
CREATE UNIQUE INDEX idx_team_requests_one_pending ON public.team_requests(tournament_id, user_id)
  WHERE status = 'pending';

-- 2. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_team_requests_tournament ON public.team_requests(tournament_id);
CREATE INDEX IF NOT EXISTS idx_team_requests_user ON public.team_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_team_requests_status ON public.team_requests(status);
CREATE INDEX IF NOT EXISTS idx_team_requests_target_team ON public.team_requests(target_team_id);

-- 3. Supprimer la contrainte incorrecte si elle existe
ALTER TABLE public.team_requests DROP CONSTRAINT IF EXISTS one_pending_request_per_user;

-- 4. RLS Policies pour team_requests
ALTER TABLE public.team_requests ENABLE ROW LEVEL SECURITY;

-- Lecture: le créateur du tournoi peut voir toutes les demandes, le joueur peut voir ses propres demandes
CREATE POLICY "team_requests_select_policy" ON public.team_requests
FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = team_requests.tournament_id
    AND t.creator_id = auth.uid()
  )
);

-- Insertion: tout participant du tournoi peut créer une demande
CREATE POLICY "team_requests_insert_policy" ON public.team_requests
FOR INSERT WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tournament_participants tp
    WHERE tp.tournament_id = team_requests.tournament_id
    AND tp.user_id = auth.uid()
  )
);

-- Modification: le créateur du tournoi peut modifier les demandes (pour approuver/rejeter)
CREATE POLICY "team_requests_update_policy" ON public.team_requests
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = team_requests.tournament_id
    AND t.creator_id = auth.uid()
  )
);

-- Suppression: le joueur peut supprimer sa propre demande en attente
CREATE POLICY "team_requests_delete_policy" ON public.team_requests
FOR DELETE USING (
  user_id = auth.uid()
  AND status = 'pending'
);

-- 5. Ajouter une colonne notification pour les préférences de notification d'équipe dans profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS notify_team_requests BOOLEAN DEFAULT TRUE;

-- 6. Fonction pour nettoyer les demandes expirées (optionnel)
CREATE OR REPLACE FUNCTION public.cleanup_old_team_requests()
RETURNS void AS $$
BEGIN
  -- Supprimer les demandes en attente datant de plus de 30 jours
  DELETE FROM public.team_requests
  WHERE status = 'pending'
  AND created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_team_request_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS team_requests_updated_at ON public.team_requests;
CREATE TRIGGER team_requests_updated_at
  BEFORE UPDATE ON public.team_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_team_request_timestamp();

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
