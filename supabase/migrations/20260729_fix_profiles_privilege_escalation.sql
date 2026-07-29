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

-- 1) CRITIQUE — empêcher toute modification de `role` par les utilisateurs.
--    ⚠️ Un `REVOKE UPDATE (role)` au niveau colonne NE FONCTIONNE PAS : Supabase pose un
--    GRANT UPDATE au niveau TABLE sur `authenticated`, qui couvre déjà toutes les colonnes
--    (testé : l'escalade passait toujours). La parade propre et non-cassante = un TRIGGER qui
--    interdit le changement de `role`, sauf pour la service_role (ops admin légitimes) et le
--    superuser (SQL Editor / promotions manuelles).
CREATE OR REPLACE FUNCTION public.prevent_profile_role_change()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role'
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    RAISE EXCEPTION 'Modification du rôle non autorisée';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_role_change
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_role_change();

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
