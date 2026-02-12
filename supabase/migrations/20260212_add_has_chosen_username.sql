-- Ajouter le flag has_chosen_username pour permettre aux users OAuth
-- de changer leur pseudo auto-généré une seule fois
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS has_chosen_username BOOLEAN DEFAULT true;

-- Marquer les users OAuth existants qui n'ont jamais choisi leur pseudo
-- (ceux dont le username = partie avant @ de l'email)
UPDATE profiles SET has_chosen_username = false
WHERE username = split_part(email, '@', 1);
