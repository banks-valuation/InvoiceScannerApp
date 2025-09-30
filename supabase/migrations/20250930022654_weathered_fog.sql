/*
  # Update description category constraint to use 'Dental' instead of 'Dentist'

  1. Changes
    - Update the check constraint on invoices table to accept 'Dental' instead of 'Dentist'
    - Update any existing records that have 'Dentist' to 'Dental'

  2. Security
    - No RLS changes needed as this only updates constraint values
*/

-- First update any existing records from 'Dentist' to 'Dental'
UPDATE invoices 
SET description_category = 'Dental' 
WHERE description_category = 'Dentist';

-- Drop the existing constraint
ALTER TABLE invoices DROP CONSTRAINT IF EXISTS invoices_description_category_check;

-- Add the new constraint with 'Dental' instead of 'Dentist'
ALTER TABLE invoices ADD CONSTRAINT invoices_description_category_check 
CHECK ((description_category = ANY (ARRAY['Massage Therapy'::text, 'Physio Therapy'::text, 'Dental'::text, 'Prescription Medication'::text, 'Vision'::text, 'Other'::text])));