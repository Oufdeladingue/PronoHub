-- Add avatar column to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar VARCHAR(50) DEFAULT 'avatar1';

-- Update existing profiles to have a default avatar if they don't have one
UPDATE profiles SET avatar = 'avatar1' WHERE avatar IS NULL;
