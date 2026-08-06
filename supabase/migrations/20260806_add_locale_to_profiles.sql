-- Ajoute la langue choisie explicitement par l'utilisateur.
-- NULL = pas de choix explicite → l'app détermine la langue (pays > navigateur > défaut FR).
-- Une valeur ('fr', 'en', ...) = choix explicite du joueur, prioritaire sur la détection.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS locale VARCHAR(5);

COMMENT ON COLUMN profiles.locale IS 'Langue préférée choisie par l''utilisateur (ex: fr, en). NULL = détection automatique.';
