/*
  # Add sequence_id field for Excel tracking

  1. Changes
    - Add `sequence_id` column to `invoices` table as auto-incrementing integer
    - Set it as unique and not null
    - Backfill existing records with sequential numbers
    - Create sequence starting from next available number

  2. Purpose
    - Provide user-friendly sequential IDs for Excel instead of UUIDs
    - Maintain referential integrity with existing UUID primary keys
*/

-- Add sequence_id column
ALTER TABLE invoices ADD COLUMN sequence_id SERIAL UNIQUE;

-- Update existing records to have sequential IDs based on creation order
WITH numbered_invoices AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) as row_num
  FROM invoices
)
UPDATE invoices 
SET sequence_id = numbered_invoices.row_num
FROM numbered_invoices 
WHERE invoices.id = numbered_invoices.id;

-- Make sequence_id NOT NULL after backfilling
ALTER TABLE invoices ALTER COLUMN sequence_id SET NOT NULL;