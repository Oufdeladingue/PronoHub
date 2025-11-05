-- Add theme_preference column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS theme_preference TEXT DEFAULT 'light' CHECK (theme_preference IN ('light', 'dark'));

-- Add comment to column
COMMENT ON COLUMN profiles.theme_preference IS 'User preferred theme (light or dark)';
