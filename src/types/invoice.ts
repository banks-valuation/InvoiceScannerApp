export interface Invoice {
  id: string;
  sequence_id: number; // Auto-incrementing ID for Excel tracking
  customer_name: string;
  invoice_date: string;
  invoice_amount: number;
  description_category: 'Massage Therapy' | 'Physio Therapy' | 'Dentist' | 'Prescription Medication' | 'Vision' | 'Other';
  description_other?: string;
  file_url: string;
  file_type: 'image' | 'pdf';
  onedrive_uploaded?: boolean;
  onedrive_file_url?: string;
  excel_synced?: boolean;
  created_at: string;
  updated_at: string;
}

export interface InvoiceFormData {
  customer_name: string;
  invoice_date: string;
  invoice_amount: string;
  description_category: Invoice['description_category'];
  description_other?: string;
  file?: File;
}