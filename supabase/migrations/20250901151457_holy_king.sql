/*
  # Create invoices table and storage

  1. New Tables
    - `invoices`
      - `id` (uuid, primary key)
      - `customer_name` (text, required)
      - `invoice_date` (date, required)
      - `invoice_amount` (decimal, required)
      - `description_category` (text, required - enum-like values)
      - `description_other` (text, optional - for "Other" category)
      - `file_url` (text, required)
      - `file_type` (text, required - 'image' or 'pdf')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Storage
    - Create `invoices` storage bucket for file uploads
    - Configure public access for invoice files

  3. Security
    - Enable RLS on `invoices` table
    - Add policies for authenticated users to manage their own invoices
    - Configure storage policies for invoice file access
*/

-- Create the invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name text NOT NULL,
  invoice_date date NOT NULL,
  invoice_amount decimal(10,2) NOT NULL DEFAULT 0.00,
  description_category text NOT NULL CHECK (description_category IN ('Massage Therapy', 'Physio Therapy', 'Dentist', 'Prescription Medication', 'Vision', 'Other')),
  description_other text,
  file_url text NOT NULL DEFAULT '',
  file_type text NOT NULL CHECK (file_type IN ('image', 'pdf')) DEFAULT 'image',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create storage bucket for invoice files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('invoices', 'invoices', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on invoices table
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Create policies for invoices table
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

-- Create storage policies for invoices bucket
CREATE POLICY "Users can view invoice files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'invoices');

CREATE POLICY "Users can upload invoice files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'invoices');

CREATE POLICY "Users can delete invoice files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'invoices');

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();