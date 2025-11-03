-- Supprimer l'ancien trigger
DROP TRIGGER IF EXISTS update_admin_settings_updated_at ON public.admin_settings;

-- Créer ou remplacer la fonction de mise à jour
CREATE OR REPLACE FUNCTION update_admin_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recréer le trigger avec la bonne fonction
CREATE TRIGGER update_admin_settings_updated_at
    BEFORE UPDATE ON public.admin_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_admin_settings_updated_at();
