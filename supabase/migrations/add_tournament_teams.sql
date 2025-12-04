-- =====================================================
-- MIGRATION: Système d'équipes pour tournois Elite/Platinium
-- Date: 2025-12-04
-- =====================================================
-- Permet aux capitaines de créer des équipes dans les tournois
-- Elite Team et Platinium, avec drag & drop des joueurs
-- =====================================================

-- 1. Ajouter colonne teams_enabled sur tournaments
ALTER TABLE public.tournaments
ADD COLUMN IF NOT EXISTS teams_enabled BOOLEAN DEFAULT FALSE;

-- 2. Table des équipes de tournoi
CREATE TABLE IF NOT EXISTS public.tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name VARCHAR(15) NOT NULL,
  avatar VARCHAR(50) DEFAULT 'team1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte: nom unique par tournoi
  UNIQUE(tournament_id, name)
);

-- 3. Table des membres d'équipe
CREATE TABLE IF NOT EXISTS public.tournament_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.tournament_teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),

  -- Contrainte: un joueur ne peut être que dans une seule équipe par tournoi
  UNIQUE(tournament_id, user_id)
);

-- 4. Index pour les performances
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament ON public.tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_team_members_team ON public.tournament_team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_tournament_team_members_user ON public.tournament_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_tournament_team_members_tournament ON public.tournament_team_members(tournament_id);

-- 5. RLS Policies pour tournament_teams
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;

-- Lecture: tous les participants du tournoi peuvent voir les équipes
CREATE POLICY "tournament_teams_select_policy" ON public.tournament_teams
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tournament_participants tp
    WHERE tp.tournament_id = tournament_teams.tournament_id
    AND tp.user_id = auth.uid()
  )
);

-- Insertion: seul le créateur du tournoi peut créer des équipes
CREATE POLICY "tournament_teams_insert_policy" ON public.tournament_teams
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_teams.tournament_id
    AND t.creator_id = auth.uid()
  )
);

-- Modification: seul le créateur du tournoi peut modifier les équipes
CREATE POLICY "tournament_teams_update_policy" ON public.tournament_teams
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_teams.tournament_id
    AND t.creator_id = auth.uid()
  )
);

-- Suppression: seul le créateur du tournoi peut supprimer les équipes
CREATE POLICY "tournament_teams_delete_policy" ON public.tournament_teams
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_teams.tournament_id
    AND t.creator_id = auth.uid()
  )
);

-- 6. RLS Policies pour tournament_team_members
ALTER TABLE public.tournament_team_members ENABLE ROW LEVEL SECURITY;

-- Lecture: tous les participants du tournoi peuvent voir les membres
CREATE POLICY "tournament_team_members_select_policy" ON public.tournament_team_members
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tournament_participants tp
    WHERE tp.tournament_id = tournament_team_members.tournament_id
    AND tp.user_id = auth.uid()
  )
);

-- Insertion: seul le créateur du tournoi peut ajouter des membres
CREATE POLICY "tournament_team_members_insert_policy" ON public.tournament_team_members
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_team_members.tournament_id
    AND t.creator_id = auth.uid()
  )
);

-- Modification: seul le créateur du tournoi peut modifier les membres
CREATE POLICY "tournament_team_members_update_policy" ON public.tournament_team_members
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_team_members.tournament_id
    AND t.creator_id = auth.uid()
  )
);

-- Suppression: seul le créateur du tournoi peut retirer des membres
CREATE POLICY "tournament_team_members_delete_policy" ON public.tournament_team_members
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.tournaments t
    WHERE t.id = tournament_team_members.tournament_id
    AND t.creator_id = auth.uid()
  )
);

-- 7. Fonction pour vérifier si tous les joueurs sont dans une équipe
CREATE OR REPLACE FUNCTION public.check_all_players_in_teams(p_tournament_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_teams_enabled BOOLEAN;
  v_total_participants INTEGER;
  v_players_in_teams INTEGER;
BEGIN
  -- Vérifier si le mode équipe est activé
  SELECT teams_enabled INTO v_teams_enabled
  FROM public.tournaments
  WHERE id = p_tournament_id;

  -- Si le mode équipe n'est pas activé, retourner true
  IF NOT v_teams_enabled THEN
    RETURN TRUE;
  END IF;

  -- Compter le nombre total de participants
  SELECT COUNT(*) INTO v_total_participants
  FROM public.tournament_participants
  WHERE tournament_id = p_tournament_id;

  -- Compter le nombre de joueurs dans des équipes
  SELECT COUNT(*) INTO v_players_in_teams
  FROM public.tournament_team_members
  WHERE tournament_id = p_tournament_id;

  -- Retourner true si tous les joueurs sont dans une équipe
  RETURN v_total_participants = v_players_in_teams;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Note: Le classement par équipe est calculé dynamiquement via l'API
-- /api/tournaments/[tournamentId]/teams/rankings
-- qui utilise l'API de classement individuel existante pour calculer les moyennes
-- Cela évite de dupliquer la logique de calcul des points

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
