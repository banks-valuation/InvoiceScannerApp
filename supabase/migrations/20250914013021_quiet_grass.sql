/*
  # Add auto-incrementing sequence_id field

  1. New Columns
    - `sequence_id` (integer, auto-incrementing, unique, not null)
      - Sequential ID for Excel tracking (1, 2, 3, etc.)
      - Replaces UUID display in Excel files
      - Backfilled for existing records based on creation order

  2. Changes
    - Existing invoices get sequential numbers based on creation date
    - New invoices automatically get next sequential number
    - Maintains existing UUID primary key for internal references

  3. Notes
    - Uses temporary sequence to avoid duplicate key conflicts
    - Handles existing data gracefully
    - Ensures proper auto-increment behavior for new records
*/

-- First, check if the column already exists and drop it if it does
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'invoices' AND column_name = 'sequence_id'
  ) THEN
    ALTER TABLE invoices DROP COLUMN sequence_id;
  END IF;
END $$;

-- Create a temporary sequence for generating sequential IDs
CREATE TEMPORARY SEQUENCE temp_seq START 1;

-- Add sequence_id column as integer (not SERIAL yet to avoid conflicts)
ALTER TABLE invoices ADD COLUMN sequence_id INTEGER;

-- Update existing records with sequential IDs based on creation order
WITH numbered_invoices AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) as row_num
  FROM invoices
)
UPDATE invoices 
SET sequence_id = numbered_invoices.row_num
FROM numbered_invoices 
WHERE invoices.id = numbered_invoices.id;

-- Create a proper sequence for future inserts
CREATE SEQUENCE invoices_sequence_id_seq;

-- Set the sequence to start from the next number after existing records
SELECT setval('invoices_sequence_id_seq', COALESCE(MAX(sequence_id), 0) + 1, false) FROM invoices;

-- Set the default value for the column to use the sequence
ALTER TABLE invoices ALTER COLUMN sequence_id SET DEFAULT nextval('invoices_sequence_id_seq');

-- Make sequence_id NOT NULL and UNIQUE
ALTER TABLE invoices ALTER COLUMN sequence_id SET NOT NULL;
ALTER TABLE invoices ADD CONSTRAINT invoices_sequence_id_unique UNIQUE (sequence_id);

-- Set the sequence to be owned by the column (for proper cleanup)
ALTER SEQUENCE invoices_sequence_id_seq OWNED BY invoices.sequence_id;