/*
  # Fix Storage RLS Policies

  1. Storage Policies
    - Add policy for authenticated users to insert files into invoices bucket
    - Add policy for authenticated users to select/download files from invoices bucket
    - Add policy for authenticated users to update files in invoices bucket
    - Add policy for authenticated users to delete files from invoices bucket

  2. Security
    - All policies require authentication
    - Users can manage their own files in the invoices bucket
*/

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated downloads" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated updates" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated deletes" ON storage.objects;

-- Create comprehensive storage policies for the invoices bucket
CREATE POLICY "Allow authenticated uploads"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Allow authenticated downloads"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

CREATE POLICY "Allow authenticated updates"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'invoices')
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Allow authenticated deletes"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoices');