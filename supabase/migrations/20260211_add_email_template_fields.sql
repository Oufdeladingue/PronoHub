-- Migration: Ajout champs template/contenu pour l'éditeur WYSIWYG email
-- email_template_id: ID du template utilisé (blank, announcement, simple)
-- email_content_html: HTML du contenu seul (produit par Tiptap), séparé du template wrapper

ALTER TABLE admin_communications ADD COLUMN IF NOT EXISTS email_template_id VARCHAR(50);
ALTER TABLE admin_communications ADD COLUMN IF NOT EXISTS email_content_html TEXT;
