/*
  # Fix RLS policies for Microsoft authentication

  1. Security Updates
    - Add RLS policy for Microsoft User ID access
    - Update existing policies to handle both auth types
    - Add helper function for setting MS user context

  2. Changes
    - Add policy for MS user ID access via session variable
    - Keep existing policies for backward compatibility
    - Add function to set current MS user ID in session
*/

-- Add a function to set the current Microsoft user ID in the session
CREATE OR REPLACE FUNCTION set_ms_user_id(ms_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Set the Microsoft user ID in the current session
  PERFORM set_config('app.ms_user_id', ms_user_id, true);
END;
$$;

-- Add RLS policy for Microsoft User ID access
CREATE POLICY "Users can access settings via MS User ID"
  ON user_settings
  FOR ALL
  TO authenticated
  USING (ms_user_id = current_setting('app.ms_user_id', true))
  WITH CHECK (ms_user_id = current_setting('app.ms_user_id', true));

-- Update the invoices table to also support MS user access
-- Add the ms_user_id column to invoices table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'ms_user_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN ms_user_id text;
    
    -- Add index for efficient lookups
    CREATE INDEX IF NOT EXISTS invoices_ms_user_id_idx ON invoices(ms_user_id);
  END IF;
END $$;

-- Add RLS policy for invoices via MS User ID
CREATE POLICY "Users can access invoices via MS User ID"
  ON invoices
  FOR ALL
  TO authenticated
  USING (ms_user_id = current_setting('app.ms_user_id', true))
  WITH CHECK (ms_user_id = current_setting('app.ms_user_id', true));