-- Migration de la table tournaments existante
-- Ajouter les colonnes manquantes et adapter la structure

-- Ajouter la colonne slug si elle n'existe pas
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'tournaments'
                   AND column_name = 'slug') THEN
        ALTER TABLE public.tournaments ADD COLUMN slug VARCHAR(8);
    END IF;
END $$;

-- Ajouter la colonne num_matchdays (renommer matchdays_count)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'tournaments'
                   AND column_name = 'num_matchdays') THEN
        ALTER TABLE public.tournaments ADD COLUMN num_matchdays INTEGER;
    END IF;
END $$;

-- Ajouter la colonne all_matchdays
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'tournaments'
                   AND column_name = 'all_matchdays') THEN
        ALTER TABLE public.tournaments ADD COLUMN all_matchdays BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Ajouter la colonne bonus_match_enabled
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'tournaments'
                   AND column_name = 'bonus_match_enabled') THEN
        ALTER TABLE public.tournaments ADD COLUMN bonus_match_enabled BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- Ajouter la colonne max_players (renommer max_participants)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_schema = 'public'
                   AND table_name = 'tournaments'
                   AND column_name = 'max_players') THEN
        ALTER TABLE public.tournaments ADD COLUMN max_players INTEGER;
    END IF;
END $$;

-- Copier les données de invite_code vers slug (en prenant les 8 premiers caractères)
UPDATE public.tournaments
SET slug = UPPER(SUBSTRING(invite_code FROM 1 FOR 8))
WHERE slug IS NULL AND invite_code IS NOT NULL;

-- Copier matchdays_count vers num_matchdays
UPDATE public.tournaments
SET num_matchdays = matchdays_count
WHERE num_matchdays IS NULL AND matchdays_count IS NOT NULL;

-- Copier max_participants vers max_players
UPDATE public.tournaments
SET max_players = max_participants
WHERE max_players IS NULL AND max_participants IS NOT NULL;

-- Ajouter une contrainte unique sur slug
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS tournaments_slug_key;
ALTER TABLE public.tournaments ADD CONSTRAINT tournaments_slug_key UNIQUE (slug);

-- Ajouter la contrainte de format sur slug
ALTER TABLE public.tournaments DROP CONSTRAINT IF EXISTS slug_format;
ALTER TABLE public.tournaments ADD CONSTRAINT slug_format CHECK (slug ~ '^[A-Z]{8}$');

-- Table des participants au tournoi (créer si n'existe pas)
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

-- Policies RLS pour tournaments (si elles n'existent pas déjà)
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view tournaments" ON public.tournaments;
CREATE POLICY "Anyone can view tournaments"
    ON public.tournaments
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Authenticated users can create tournaments" ON public.tournaments;
CREATE POLICY "Authenticated users can create tournaments"
    ON public.tournaments
    FOR INSERT
    WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can update their tournaments" ON public.tournaments;
CREATE POLICY "Creators can update their tournaments"
    ON public.tournaments
    FOR UPDATE
    USING (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can delete their tournaments" ON public.tournaments;
CREATE POLICY "Creators can delete their tournaments"
    ON public.tournaments
    FOR DELETE
    USING (auth.uid() = creator_id);

-- Policies RLS pour tournament_players
ALTER TABLE public.tournament_players ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view tournament players" ON public.tournament_players;
CREATE POLICY "Anyone can view tournament players"
    ON public.tournament_players
    FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Users can join tournaments" ON public.tournament_players;
CREATE POLICY "Users can join tournaments"
    ON public.tournament_players
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave tournaments" ON public.tournament_players;
CREATE POLICY "Users can leave tournaments"
    ON public.tournament_players
    FOR DELETE
    USING (auth.uid() = user_id AND is_captain = false);
