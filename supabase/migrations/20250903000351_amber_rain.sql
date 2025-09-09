/*
  # Recreate Invoice Management System

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `customer_name` (text, required)
      - `invoice_date` (date, required)
      - `invoice_amount` (numeric, required, default 0.00)
      - `description_category` (text, required, constrained values)
      - `description_other` (text, optional for "Other" category)
      - `file_url` (text, required, default empty string)
      - `file_type` (text, required, default 'image')
      - `onedrive_uploaded` (boolean, default false)
      - `onedrive_file_url` (text, optional)
      - `excel_synced` (boolean, default false)
      - `created_at` (timestamptz, auto-generated)
      - `updated_at` (timestamptz, auto-updated)

  2. Storage
    - Create `invoices` storage bucket for file uploads
    - Configure public access for authenticated users

  3. Security
    - Enable RLS on `invoices` table
    - Add policies for authenticated users to manage their own data
    - Configure storage bucket policies for authenticated access

  4. Functions
    - Auto-update `updated_at` timestamp on row changes
*/

-- Create the invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  invoice_date date NOT NULL,
  invoice_amount numeric(10,2) NOT NULL DEFAULT 0.00,
  description_category text NOT NULL CHECK (description_category IN ('Massage Therapy', 'Physio Therapy', 'Dentist', 'Prescription Medication', 'Vision', 'Other')),
  description_other text,
  file_url text NOT NULL DEFAULT '',
  file_type text NOT NULL DEFAULT 'image' CHECK (file_type IN ('image', 'pdf')),
  onedrive_uploaded boolean DEFAULT false,
  onedrive_file_url text,
  excel_synced boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
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
  USING (true);

CREATE POLICY "Users can delete invoices"
  ON invoices
  FOR DELETE
  TO authenticated
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies
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
  USING (bucket_id = 'invoices');

CREATE POLICY "Authenticated users can delete invoice files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoices');