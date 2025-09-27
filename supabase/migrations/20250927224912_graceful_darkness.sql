/*
  # Add Microsoft User ID column to user_settings table

  1. Changes
    - Add `ms_user_id` column to `user_settings` table
    - Add unique index on `ms_user_id` for efficient lookups
    - Update RLS policies to work with both user_id and ms_user_id

  2. Security
    - Maintain existing RLS policies
    - Add policy for Microsoft user ID access
*/

-- Add Microsoft User ID column
ALTER TABLE user_settings 
ADD COLUMN IF NOT EXISTS ms_user_id text;

-- Create unique index on ms_user_id for efficient lookups
CREATE UNIQUE INDEX IF NOT EXISTS user_settings_ms_user_id_idx 
ON user_settings (ms_user_id) 
WHERE ms_user_id IS NOT NULL;

-- Add RLS policy for Microsoft user ID access
CREATE POLICY "Users can access settings via MS User ID"
  ON user_settings
  FOR ALL
  TO authenticated
  USING (ms_user_id = current_setting('app.ms_user_id', true))
  WITH CHECK (ms_user_id = current_setting('app.ms_user_id', true));

-- Add comment to document the new column
COMMENT ON COLUMN user_settings.ms_user_id IS 'Microsoft Graph API user ID for linking Microsoft authentication';