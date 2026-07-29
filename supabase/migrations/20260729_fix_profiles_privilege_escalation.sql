-- ============================================================================
-- CORRECTIF SÉCURITÉ URGENT — table profiles
-- ============================================================================
-- Contexte : la policy RLS "Users can update own profile" est ROW-level
-- (USING auth.uid() = id) SANS restriction de colonne. Or les écritures du
-- profil se font côté CLIENT (supabase.from('profiles').upsert(...)) avec le
-- JWT de l'utilisateur. Conséquence testée en prod (2026-07-29) :
--   • un user peut PATCH profiles.role = 'super_admin'  → ESCALADE ADMIN (CRITIQUE)
--   • un user peut écrire un username arbitraire (200c, HTML) → XSS stocké
--
-- La RLS row-level ne protège PAS les colonnes : le correctif se fait via les
-- privilèges de colonne Postgres (+ une contrainte de format sur username).
-- À exécuter dans le SQL Editor Supabase.
-- ============================================================================

-- 1) CRITIQUE — empêcher toute modification de `role` par les rôles publics.
--    Les opérations admin légitimes passent par la service_role (createAdminClient),
--    qui n'est PAS affectée par ce REVOKE.
REVOKE UPDATE (role) ON public.profiles FROM anon, authenticated;

-- (Optionnel, défense en profondeur — décommenter si aucun flux client ne les écrit)
-- REVOKE UPDATE (id, created_at) ON public.profiles FROM anon, authenticated;
-- NB : NE PAS révoquer username / email / has_chosen_username / last_seen_at /
--      updated_at : le flux légitime choose-username (upsert client) en a besoin.

-- 2) Valider le format du username au niveau base (barrière même si le client
--    est contourné). NOT VALID = n'affecte pas les lignes existantes, seulement
--    les prochaines écritures. Bloque les chevrons HTML et borne la longueur.
ALTER TABLE public.profiles
  ADD CONSTRAINT username_len_safe
  CHECK (username IS NULL OR (char_length(username) <= 20 AND username !~ '[<>"]'))
  NOT VALID;

-- 3) (Recommandé) Unicité insensible à la casse pour éviter l'usurpation de pseudo.
--    Échouera s'il existe déjà des doublons — les lister avant si l'index ne se crée pas :
--      SELECT lower(username), count(*) FROM public.profiles
--      GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_unique
  ON public.profiles (lower(username));

-- Vérif post-correctif : cette requête en tant qu'user ne doit plus pouvoir
-- changer role (403/42501). Les privilèges restants :
--   SELECT grantee, privilege_type, column_name
--   FROM information_schema.column_privileges
--   WHERE table_name = 'profiles' AND column_name = 'role';
