import { supabase } from '../lib/supabaseClient';
import { Invoice, InvoiceFormData } from '../types/invoice';

/**
 * SupabaseInvoiceService
 *
 * Notes:
 * - We no longer call supabase.auth.getUser() inside this service.
 * - Instead, pass the current user (from AuthProvider/useAuth) into methods when needed.
 */
export class SupabaseInvoiceService {
  private static readonly BUCKET_NAME = 'invoices';

  static async createInvoice(formData: InvoiceFormData, userId: string): Promise<Invoice> {
    try {
      let fileUrl = '';
      let fileType: 'image' | 'pdf' = 'image';

      // Upload file to Supabase Storage if provided
      if (formData.file) {
        const uploadResult = await this.uploadFile(formData.file);
        fileUrl = uploadResult.url;
        fileType = formData.file.type.includes('pdf') ? 'pdf' : 'image';
      }

      // Insert invoice into database
      const { data, error } = await supabase
        .from('invoices')
        .insert([{
          user_id: userId,
          customer_name: formData.customer_name,
          invoice_date: formData.invoice_date,
          invoice_amount: parseFloat(formData.invoice_amount),
          description_category: formData.description_category,
          description_other: formData.description_other,
          file_url: fileUrl,
          file_type: fileType,
        }])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create invoice: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error creating invoice:', error);
      throw error;
    }
  }

  static async getInvoices(userId: string): Promise<Invoice[]> {
    try {
      console.log('Fetching invoices from Supabase...');

      invoiceFetchQuery = "query-" + Date.now();
      console.time(invoiceFetchQuery)
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      console.timeEnd(invoiceFetchQuery);

      if (error) {
        console.error('Supabase query error:', error);
        throw new Error(`Failed to fetch invoices: ${error.message}`);
      }

      console.log('Successfully fetched invoices:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }
  }

  static async updateInvoice(id: string, formData: InvoiceFormData): Promise<Invoice> {
  }
  static async updateInvoice(id: string, formData: InvoiceFormData, userId: string): Promise<Invoice> {
    try {
      // Get existing invoice to check for file changes
      const { data: existingInvoice, error: fetchError } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch existing invoice: ${fetchError.message}`);
      }

      let fileUrl = existingInvoice.file_url;
      let fileType = existingInvoice.file_type;

      // Handle file upload if new file provided
      if (formData.file) {
        // Delete old file if it exists
        if (existingInvoice.file_url) {
          await this.deleteFile(existingInvoice.file_url);
        }

        // Upload new file
        const uploadResult = await this.uploadFile(formData.file);
        fileUrl = uploadResult.url;
        fileType = formData.file.type.includes('pdf') ? 'pdf' : 'image';
      }

      // Update invoice in database
      const { data, error } = await supabase
        .from('invoices')
        .update({
          customer_name: formData.customer_name,
          invoice_date: formData.invoice_date,
          invoice_amount: parseFloat(formData.invoice_amount),
          description_category: formData.description_category,
          description_other: formData.description_other,
          file_url: fileUrl,
          file_type: fileType,
        })
        .eq('id', id)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update invoice: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error updating invoice:', error);
      throw error;
    }
  }

  static async deleteInvoice(id: string): Promise<void> {
  }
  static async deleteInvoice(id: string, userId: string): Promise<void> {
    try {
      // Get invoice to access file URL for deletion
      const { data: invoice, error: fetchError } = await supabase
        .from('invoices')
        .select('file_url')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        console.warn('Could not fetch invoice for file cleanup:', fetchError.message);
      }

      // Delete file from storage if it exists
      if (invoice?.file_url) {
        await this.deleteFile(invoice.file_url);
      }

      // Delete invoice from database
      const { error } = await supabase
        .from('invoices')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to delete invoice: ${error.message}`);
      }
    } catch (error) {
      console.error('Error deleting invoice:', error);
      throw error;
    }
  }

  static async updateInvoiceOneDriveStatus(
    id: string,
    oneDriveData: {
      onedrive_uploaded: boolean;
      onedrive_file_url?: string;
      excel_synced?: boolean;
    }
  ): Promise<Invoice> {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .update(oneDriveData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update OneDrive status: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Error updating OneDrive status:', error);
      throw error;
    }
  }

  private static async uploadFile(file: File): Promise<{ url: string }> {
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `invoices/${fileName}`;

      // Upload file to Supabase Storage
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (error) {
        throw new Error(`File upload failed: ${error.message}`);
      }

      // Get public URL for the uploaded file
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(data.path);

      return { url: urlData.publicUrl };
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  }

  private static async deleteFile(fileUrl: string): Promise<void> {
    try {
      // Extract file path from URL
      const url = new URL(fileUrl);
      const pathParts = url.pathname.split('/');
      const filePath = pathParts.slice(-2).join('/'); // Get 'invoices/filename.ext'

      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([filePath]);

      if (error) {
        console.warn('Failed to delete file from storage:', error.message);
      }
    } catch (error) {
      console.warn('Error deleting file:', error);
    }
  }

  static getFileUrl(fileUrl: string): string {
    return fileUrl;
  }
}
