-- Trigger pour créer automatiquement un profil après la confirmation de l'email
-- Exécutez ce script dans l'éditeur SQL de Supabase

-- Fonction pour créer le profil utilisateur automatiquement
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email, notification_preferences)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    NEW.email,
    '{"email_reminder": true, "email_tournament_started": true, "email_day_recap": true, "email_tournament_end": true, "email_invite": true, "email_player_joined": true, "email_mention": true, "email_badge_unlocked": true, "email_new_matches": true}'::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger qui s'exécute après l'insertion d'un nouvel utilisateur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  WHEN (NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_new_user();

-- Note: Si l'utilisateur existe déjà mais n'a pas de profil, vous pouvez l'ajouter manuellement
-- ou créer un autre trigger pour gérer les confirmations d'email tardives
