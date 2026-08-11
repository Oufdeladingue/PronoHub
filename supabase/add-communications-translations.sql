-- Communications admin multilingues : variantes par langue du contenu email/push.
-- Les colonnes existantes (email_subject, email_body_html, email_preview_text,
-- email_cta_text, notification_title, notification_body) restent la version FR (défaut).
-- `translations` porte les autres langues, chacune avec le même jeu de champs textuels :
--
--   {
--     "en": { "email_subject": "...", "email_preview_text": "...", "email_body_html": "...",
--             "email_cta_text": "...", "notification_title": "...", "notification_body": "..." },
--     "es": { ... }, "de": { ... }, "it": { ... }
--   }
--
-- À l'envoi, on choisit la variante selon profiles.locale (repli FR si absente/champ vide).
-- email_cta_url, notification_click_url, notification_image_url et le ciblage restent partagés.
--
-- Idempotent.

ALTER TABLE admin_communications
  ADD COLUMN IF NOT EXISTS translations jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN admin_communications.translations IS
  'Variantes de contenu par langue (en/es/de/it). FR = colonnes racine. Repli FR par champ à l''envoi.';
