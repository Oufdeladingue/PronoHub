-- Ajouter les colonnes pour choisir les canaux d'envoi
ALTER TABLE admin_communications
ADD COLUMN IF NOT EXISTS send_email BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS send_push BOOLEAN DEFAULT true;

-- Mettre à jour les communications existantes
UPDATE admin_communications
SET send_email = true, send_push = true
WHERE send_email IS NULL OR send_push IS NULL;
