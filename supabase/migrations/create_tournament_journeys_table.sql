-- ================================================
-- MIGRATION: Créer la table tournament_journeys
-- ================================================
-- À exécuter dans: Supabase Dashboard > SQL Editor
-- ================================================

-- Créer la table tournament_journeys pour tracker les journées de chaque tournoi
CREATE TABLE IF NOT EXISTS public.tournament_journeys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tournament_id UUID NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
    journey_number INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, active, completed
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tournament_journey UNIQUE(tournament_id, journey_number),
    CONSTRAINT positive_journey_number CHECK (journey_number > 0)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_tournament_journeys_tournament ON public.tournament_journeys(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_journeys_status ON public.tournament_journeys(status);
CREATE INDEX IF NOT EXISTS idx_tournament_journeys_number ON public.tournament_journeys(tournament_id, journey_number);

-- Commentaires pour documentation
COMMENT ON TABLE public.tournament_journeys IS 'Table des journées de chaque tournoi';
COMMENT ON COLUMN public.tournament_journeys.tournament_id IS 'ID du tournoi auquel appartient cette journée';
COMMENT ON COLUMN public.tournament_journeys.journey_number IS 'Numéro de la journée (1, 2, 3, ...)';
COMMENT ON COLUMN public.tournament_journeys.status IS 'Statut de la journée: pending (en attente), active (en cours), completed (terminée)';
COMMENT ON COLUMN public.tournament_journeys.started_at IS 'Date et heure de début de la journée';
COMMENT ON COLUMN public.tournament_journeys.completed_at IS 'Date et heure de fin de la journée';

-- Policies RLS pour tournament_journeys
ALTER TABLE public.tournament_journeys ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les journées des tournois
CREATE POLICY "Anyone can view tournament journeys"
    ON public.tournament_journeys
    FOR SELECT
    USING (true);

-- Seuls les créateurs de tournois peuvent créer/modifier/supprimer les journées
CREATE POLICY "Tournament creators can manage journeys"
    ON public.tournament_journeys
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.tournaments
            WHERE tournaments.id = tournament_journeys.tournament_id
            AND tournaments.creator_id = auth.uid()
        )
    );

-- Créer les journées pour les tournois existants
-- (basé sur la colonne num_matchdays)
DO $$
DECLARE
    tournament_record RECORD;
    journey_num INTEGER;
BEGIN
    FOR tournament_record IN
        SELECT id, COALESCE(num_matchdays, matchdays_count, 1) as num_matchdays
        FROM public.tournaments
    LOOP
        -- Vérifier si des journées existent déjà
        IF NOT EXISTS (
            SELECT 1 FROM public.tournament_journeys
            WHERE tournament_id = tournament_record.id
        ) THEN
            -- Créer les journées
            FOR journey_num IN 1..tournament_record.num_matchdays LOOP
                INSERT INTO public.tournament_journeys (tournament_id, journey_number, status)
                VALUES (tournament_record.id, journey_num, 'pending')
                ON CONFLICT (tournament_id, journey_number) DO NOTHING;
            END LOOP;
        END IF;
    END LOOP;
END $$;

-- Vérifier les résultats
SELECT
    t.name as tournament_name,
    t.num_matchdays as planned_journeys,
    COUNT(tj.id) as created_journeys,
    t.status as tournament_status
FROM tournaments t
LEFT JOIN tournament_journeys tj ON t.id = tj.tournament_id
GROUP BY t.id, t.name, t.num_matchdays, t.status
ORDER BY t.created_at DESC;
