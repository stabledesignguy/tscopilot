-- Add is_active column to profiles table for user deactivation
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Update existing profiles to be active
UPDATE profiles SET is_active = true WHERE is_active IS NULL;

-- Add NOT NULL constraint after setting defaults
ALTER TABLE profiles ALTER COLUMN is_active SET NOT NULL;

-- Add index for filtering active users
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles(is_active);
