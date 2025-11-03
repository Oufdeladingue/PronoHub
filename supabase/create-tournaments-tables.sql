-- Supprimer les tables existantes si besoin (commenté par sécurité)
-- DROP TABLE IF EXISTS public.tournament_players CASCADE;
-- DROP TABLE IF EXISTS public.tournaments CASCADE;

-- Table des tournois
CREATE TABLE IF NOT EXISTS public.tournaments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(8) NOT NULL UNIQUE,
    competition_id INTEGER NOT NULL,
    competition_name VARCHAR(255) NOT NULL,
    max_players INTEGER NOT NULL DEFAULT 10,
    num_matchdays INTEGER NOT NULL,
    all_matchdays BOOLEAN DEFAULT FALSE,
    bonus_match_enabled BOOLEAN DEFAULT FALSE,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status VARCHAR(50) DEFAULT 'warmup', -- warmup, active, finished
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    CONSTRAINT slug_format CHECK (slug ~ '^[A-Z]{8}$')
);

-- Table des participants au tournoi
CREATE TABLE IF NOT EXISTS public.tournament_players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL,
    is_captain BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tournament_id, user_id)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_tournaments_slug ON public.tournaments(slug);
CREATE INDEX IF NOT EXISTS idx_tournaments_creator ON public.tournaments(creator_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON public.tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament ON public.tournament_players(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_players_user ON public.tournament_players(user_id);

-- Policies RLS pour tournaments
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les tournois
CREATE POLICY "Anyone can view tournaments"
    ON public.tournaments
    FOR SELECT
    USING (true);

-- Les utilisateurs authentifiés peuvent créer des tournois
CREATE POLICY "Authenticated users can create tournaments"
    ON public.tournaments
    FOR INSERT
    WITH CHECK (auth.uid() = creator_id);

-- Les créateurs peuvent mettre à jour leurs tournois
CREATE POLICY "Creators can update their tournaments"
    ON public.tournaments
    FOR UPDATE
    USING (auth.uid() = creator_id);

-- Les créateurs peuvent supprimer leurs tournois
CREATE POLICY "Creators can delete their tournaments"
    ON public.tournaments
    FOR DELETE
    USING (auth.uid() = creator_id);

-- Policies RLS pour tournament_players
ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut voir les joueurs des tournois
CREATE POLICY "Anyone can view tournament players"
    ON public.tournament_players
    FOR SELECT
    USING (true);

-- Les utilisateurs peuvent rejoindre un tournoi
CREATE POLICY "Users can join tournaments"
    ON public.tournament_players
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent quitter un tournoi (sauf le capitaine)
CREATE POLICY "Users can leave tournaments"
    ON public.tournament_players
    FOR DELETE
    USING (auth.uid() = user_id AND is_captain = false);
