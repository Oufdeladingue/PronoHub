-- Table pour stocker les trophées déverrouillés par les utilisateurs
CREATE TABLE IF NOT EXISTS user_trophies (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trophy_type VARCHAR(50) NOT NULL, -- 'king_of_day', 'correct_result', 'exact_score'
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_new BOOLEAN DEFAULT TRUE, -- Pour savoir si le trophée est nouveau (non vu)
  UNIQUE(user_id, trophy_type)
);

-- Index pour améliorer les performances
CREATE INDEX IF NOT EXISTS idx_user_trophies_user_id ON user_trophies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_trophies_is_new ON user_trophies(user_id, is_new);

-- Commentaires
COMMENT ON TABLE user_trophies IS 'Stocke les trophées déverrouillés par les utilisateurs';
COMMENT ON COLUMN user_trophies.trophy_type IS 'Type de trophée: king_of_day (premier d''une journée), correct_result (bon résultat), exact_score (score exact)';
COMMENT ON COLUMN user_trophies.is_new IS 'Indique si le trophée vient d''être déverrouillé et n''a pas encore été vu par l''utilisateur';
