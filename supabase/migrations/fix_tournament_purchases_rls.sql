-- =====================================================
-- MIGRATION: Fix RLS policies for tournament_purchases
-- Date: 2025-12-02
-- =====================================================
-- Ajoute les politiques RLS necessaires pour permettre
-- les insertions et lectures sur tournament_purchases
-- =====================================================

-- 1. Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can view their own purchases" ON public.tournament_purchases;
DROP POLICY IF EXISTS "Users can insert their own purchases" ON public.tournament_purchases;
DROP POLICY IF EXISTS "Users can update their own purchases" ON public.tournament_purchases;
DROP POLICY IF EXISTS "Service role can do anything" ON public.tournament_purchases;

-- 2. S'assurer que RLS est active
ALTER TABLE public.tournament_purchases ENABLE ROW LEVEL SECURITY;

-- 3. Politique pour SELECT - les utilisateurs peuvent voir leurs achats
CREATE POLICY "Users can view their own purchases"
ON public.tournament_purchases
FOR SELECT
USING (auth.uid() = user_id);

-- 4. Politique pour INSERT - les utilisateurs peuvent creer leurs achats
CREATE POLICY "Users can insert their own purchases"
ON public.tournament_purchases
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- 5. Politique pour UPDATE - les utilisateurs peuvent modifier leurs achats
CREATE POLICY "Users can update their own purchases"
ON public.tournament_purchases
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 6. Politique pour permettre au service role de tout faire (pour les webhooks Stripe)
CREATE POLICY "Service role can do anything"
ON public.tournament_purchases
FOR ALL
USING (auth.role() = 'service_role');

-- =====================================================
-- FIN DE LA MIGRATION
-- =====================================================
