import { SupabaseInvoiceService } from './supabaseInvoiceService';
import { Invoice, InvoiceFormData } from '../types/invoice';
import { MicrosoftService, OneDriveUploadResult } from './microsoftService';

export class InvoiceService {
  static async createInvoice(formData: InvoiceFormData, userId: string): Promise<Invoice> {
    return SupabaseInvoiceService.createInvoice(formData, userId);
  }

  static async getInvoices(userId: string): Promise<Invoice[]> {
    return SupabaseInvoiceService.getInvoices(userId);
  }

  static async deleteInvoice(id: string, userId: string): Promise<void> {
    // Get the invoice before deleting to access OneDrive info
    const invoices = await this.getInvoices(userId);
    const invoice = invoices.find(inv => inv.id === id);
    
    if (invoice) {
      // Delete from OneDrive if it was uploaded
      if (invoice.onedrive_uploaded && invoice.onedrive_file_url) {
        try {
          console.log('Deleting invoice from OneDrive:', invoice.onedrive_file_url);
          const oneDriveResult = await MicrosoftService.deleteFileFromOneDrive(invoice.onedrive_file_url);
          if (!oneDriveResult.success) {
            console.warn('OneDrive deletion failed:', oneDriveResult.error);
            // Continue with deletion even if OneDrive fails
          }
        } catch (error) {
          console.error('OneDrive deletion error:', error);
          // Continue with deletion even if OneDrive fails
        }
      }

      // Remove from Excel if it was synced
      if (invoice.excel_synced) {
        try {
          console.log('Removing invoice from Excel');
          const excelResult = await MicrosoftService.removeFromExcel(invoice);
          if (!excelResult.success) {
            console.warn('Excel row deletion failed:', excelResult.error);
            // Continue with deletion even if Excel fails
          }
        } catch (error) {
          console.error('Excel deletion error:', error);
          // Continue with deletion even if Excel fails
        }
      }
    }
    
    // Delete from Supabase (this also handles file cleanup)
    return SupabaseInvoiceService.deleteInvoice(id, userId);
  }

  static async updateInvoice(id: string, formData: InvoiceFormData, userId: string): Promise<Invoice> {
    return SupabaseInvoiceService.updateInvoice(id, formData, userId);
  }

  static getFileUrl(fileId: string): string {
    return SupabaseInvoiceService.getFileUrl(fileId);
  }

  static async deleteFile(fileId: string): Promise<void> {
    // File cleanup is handled by SupabaseInvoiceService
    return Promise.resolve();
  }

  static async uploadToOneDrive(invoice: Invoice): Promise<OneDriveUploadResult> {
    try {
      // Get the file from Supabase Storage
      const file = await this.getFileBlob(invoice.file_url);
      if (!file) {
        return {
          success: false,
          error: 'Invoice file not found',
        };
      }

      // Upload to OneDrive and sync to Excel
      const result = await MicrosoftService.uploadInvoiceToOneDrive(invoice, file);
      
      if (result.success) {
        // Update the invoice with OneDrive information
        await SupabaseInvoiceService.updateInvoiceOneDriveStatus(invoice.id, {
          onedrive_uploaded: true,
          onedrive_file_url: result.fileUrl,
          excel_synced: true,
        });
      }

      return result;
    } catch (error) {
      console.error('OneDrive upload failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  private static async getFileBlob(fileUrl: string): Promise<Blob | null> {
    try {
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch file: ${response.statusText}`);
      }
      return await response.blob();
    } catch (error) {
      console.error('Error fetching file blob:', error);
      return null;
    }
  }
  static async resyncToExcel(invoice: Invoice): Promise<OneDriveUploadResult> {
    try {
      if (!invoice.onedrive_uploaded || !invoice.onedrive_file_url) {
        return {
          success: false,
          error: 'Invoice must be uploaded to OneDrive first',
        };
      }

      // For resync, we want to update the existing Excel entry, not create a new one
      console.log('Resyncing invoice to Excel:', invoice.id);
      
      try {
        const updateResult = await MicrosoftService.updateInExcel({
          ...invoice,
          onedrive_file_url: invoice.onedrive_file_url,
        });
        
        if (updateResult?.success) {
          console.log('Excel resync successful');
        } else {
          //throw new Error(updateResult?.error || 'Update failed');
          console.error('Excel resync failed:', error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred',
          };          
        }
      } catch (error) {
        console.error('Excel resync failed:', error);
        // If update fails, it might be because the row doesn't exist
        // In that case, we should append it
        if (error instanceof Error && error.message.includes('not found in Excel')) {
          console.log('Row not found in Excel, appending instead');
          const appendResult = await MicrosoftService.appendToExcel({
            ...invoice,
            onedrive_file_url: invoice.onedrive_file_url,
          });
          
          if (!appendResult.success) {
            //throw new Error(appendResult.error || 'Append failed');
            console.error('Excel resync failed:', error);
            return {
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error occurred',
            };            
          }
        } else {
          throw error;
        }
      }

      // Update the local sync status
      await SupabaseInvoiceService.updateInvoiceOneDriveStatus(invoice.id, {
        onedrive_uploaded: true,
        onedrive_file_url: invoice.onedrive_file_url,
        excel_synced: true,
      });

      return {
        success: true,
        fileUrl: invoice.onedrive_file_url,
      };
    } catch (error) {
      console.error('Excel resync failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }
}