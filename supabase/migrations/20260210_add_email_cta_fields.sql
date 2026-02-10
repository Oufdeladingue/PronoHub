-- Ajouter les champs CTA pour les emails
ALTER TABLE admin_communications
ADD COLUMN IF NOT EXISTS email_cta_text VARCHAR(100),
ADD COLUMN IF NOT EXISTS email_cta_url TEXT;

COMMENT ON COLUMN admin_communications.email_cta_text IS 'Texte du bouton d''action dans l''email';
COMMENT ON COLUMN admin_communications.email_cta_url IS 'URL du bouton d''action dans l''email';
