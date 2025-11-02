-- Ajouter un système de rôles aux utilisateurs
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- 1. Créer un type enum pour les rôles
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');

-- 2. Ajouter la colonne role à la table profiles
ALTER TABLE public.profiles
ADD COLUMN role user_role DEFAULT 'user' NOT NULL;

-- 3. Créer un index pour les recherches par rôle
CREATE INDEX idx_profiles_role ON public.profiles(role);

-- 4. Assigner les rôles aux utilisateurs existants
-- Super admin
UPDATE public.profiles
SET role = 'super_admin'
WHERE email = 'admin@test.fr';

-- Les autres restent en 'user' (valeur par défaut)

-- 5. Vérifier les rôles
SELECT id, username, email, role, created_at
FROM public.profiles
ORDER BY role DESC, created_at;
