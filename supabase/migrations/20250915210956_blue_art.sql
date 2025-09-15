/*
  # Add user_id column to invoices table

  1. Changes
    - Add `user_id` column to `invoices` table
    - Set up foreign key relationship with auth.users
    - Update RLS policies to be user-specific
    - Migrate existing data (if any) to use a default user

  2. Security
    - Update RLS policies to ensure users can only access their own invoices
    - Add foreign key constraint for data integrity
*/

-- Add user_id column to invoices table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE invoices ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Update existing invoices to have a user_id (if there are any existing records)
-- This is a one-time migration - you may need to manually assign user_ids if you have existing data

-- Drop existing policies
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can view all invoices" ON invoices;

-- Create new user-specific RLS policies
CREATE POLICY "Users can view own invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own invoices"
  ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own invoices"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);