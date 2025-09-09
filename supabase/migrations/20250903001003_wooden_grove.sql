/*
  # Fix RLS policies for invoices system

  1. Storage Setup
    - Create invoices storage bucket if not exists
    - Set up proper bucket configuration
    - Add comprehensive storage policies for authenticated users

  2. Table Policies
    - Ensure invoices table has proper RLS policies
    - Allow all CRUD operations for authenticated users

  3. Security
    - All policies require authentication
    - Storage policies allow file management for authenticated users
*/

-- Create storage bucket for invoices if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  true,
  52428800, -- 50MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "Authenticated users can upload invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update invoice files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete invoice files" ON storage.objects;

-- Create comprehensive storage policies for the invoices bucket
CREATE POLICY "Authenticated users can upload invoice files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can view invoice files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can update invoice files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'invoices')
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can delete invoice files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoices');

-- Ensure invoices table has RLS enabled
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Drop existing table policies if they exist
DROP POLICY IF EXISTS "Users can view all invoices" ON invoices;
DROP POLICY IF EXISTS "Users can insert invoices" ON invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON invoices;

-- Create comprehensive table policies
CREATE POLICY "Users can view all invoices"
  ON invoices
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert invoices"
  ON invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update invoices"
  ON invoices
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete invoices"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (true);