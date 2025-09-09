import React from 'react';
import { format } from 'date-fns';
import { FileText, Image, Trash2, Edit3, Upload, CheckCircle, AlertCircle, Cloud, RefreshCw } from 'lucide-react';
import { Invoice } from '../types/invoice';
import { InvoiceService } from '../services/invoiceService';
import { MicrosoftService } from '../services/microsoftService';

interface InvoiceCardProps {
  invoice: Invoice;
  onEdit: (invoice: Invoice) => void;
  onDelete: (id: string) => void;
  onInvoiceUpdate?: (updatedInvoice: Invoice) => void;
}

export function InvoiceCard({ invoice, onEdit, onDelete, onInvoiceUpdate }: InvoiceCardProps) {
  const [isUploading, setIsUploading] = React.useState(false);
  const [isResyncing, setIsResyncing] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const formattedDate = React.useMemo(() => {
    try {
      // Parse the date string directly to avoid timezone issues
      // invoice_date is stored as YYYY-MM-DD format
      const [year, month, day] = invoice.invoice_date.split('-').map(Number);
      const date = new Date(year, month - 1, day); // month is 0-indexed
      return format(date, 'MMM dd, yyyy');
    } catch (error) {
      console.error('Date formatting error:', error, 'Date value:', invoice.invoice_date);
      return invoice.invoice_date; // Fallback to raw date string
    }
  }, [invoice.invoice_date]);
  
  const formattedAmount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(invoice.invoice_amount);

  const getDescription = () => {
    return invoice.description_category === 'Other' 
      ? invoice.description_other 
      : invoice.description_category;
  };

  const getCategoryColor = () => {
    const colors = {
      'Massage Therapy': 'bg-purple-100 text-purple-800',
      'Physio Therapy': 'bg-blue-100 text-blue-800',
      'Dentist': 'bg-green-100 text-green-800',
      'Prescription Medication': 'bg-red-100 text-red-800',
      'Vision': 'bg-orange-100 text-orange-800',
      'Other': 'bg-gray-100 text-gray-800',
    };
    return colors[invoice.description_category] || colors.Other;
  };

  const handleOneDriveUpload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log('OneDrive upload clicked for invoice:', invoice.id);
    console.log('Microsoft service authenticated:', MicrosoftService.isAuthenticated());
    
    setIsUploading(true);
    setUploadError(null);

    try {
      const result = await InvoiceService.uploadToOneDrive(invoice);
      console.log('Upload result:', result);
      
      if (result.success) {
        // Refresh the invoice data to show updated status
        const updatedInvoices = await InvoiceService.getInvoices();
        const updatedInvoice = updatedInvoices.find(inv => inv.id === invoice.id);
        if (updatedInvoice && onInvoiceUpdate) {
          onInvoiceUpdate(updatedInvoice);
        }
      } else {
        console.error('Upload failed:', result.error);
        setUploadError(result.error || 'Upload failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadError('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleExcelResync = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResyncing(true);
    setUploadError(null);

    try {
      const result = await InvoiceService.resyncToExcel(invoice);
      
      if (result.success) {
        // Refresh the invoice data to show updated status
        const updatedInvoices = await InvoiceService.getInvoices();
        const updatedInvoice = updatedInvoices.find(inv => inv.id === invoice.id);
        if (updatedInvoice && onInvoiceUpdate) {
          onInvoiceUpdate(updatedInvoice);
        }
      } else {
        setUploadError(result.error || 'Resync failed');
      }
    } catch (error) {
      setUploadError('Resync failed. Please try again.');
    } finally {
      setIsResyncing(false);
    }
  };

  const getOneDriveStatus = () => {
    if (invoice.onedrive_uploaded) {
      return {
        icon: CheckCircle,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        title: 'Uploaded to OneDrive and synced to Excel',
        text: 'Synced',
      };
    }
    return null;
  };

  const oneDriveStatus = getOneDriveStatus();

  return (
    <div 
      className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200 cursor-pointer"
      onClick={() => onEdit(invoice)}
    >
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {invoice.customer_name}
            </h3>
            <p className="text-sm text-gray-500">{formattedDate}</p>
            {oneDriveStatus && (
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium mt-2 ${oneDriveStatus.bgColor} ${oneDriveStatus.color}`}>
                <oneDriveStatus.icon className="w-3 h-3" />
                {oneDriveStatus.text}
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold text-gray-900">{formattedAmount}</p>
            <div className="flex items-center gap-1 mt-2 flex-wrap">
              {!invoice.onedrive_uploaded && (
                <button
                  onClick={handleOneDriveUpload}
                  disabled={isUploading}
                  className={`p-2 rounded-lg transition-colors ${
                    isUploading 
                      ? 'text-gray-400 bg-gray-50 cursor-not-allowed' 
                      : 'text-blue-500 hover:bg-blue-50'
                  }`}
                  title={isUploading ? 'Uploading to OneDrive...' : 'Upload to OneDrive'}
                >
                  {isUploading ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Cloud className="w-4 h-4" />
                  )}
                </button>
              )}
              {invoice.onedrive_uploaded && (
                <button
                  onClick={handleExcelResync}
                  disabled={isResyncing}
                  className={`p-2 rounded-lg transition-colors ${
                    isResyncing 
                      ? 'text-gray-400 bg-gray-50 cursor-not-allowed' 
                      : 'text-emerald-500 hover:bg-emerald-50'
                  }`}
                  title={isResyncing ? 'Resyncing to Excel...' : 'Resync to Excel'}
                >
                  {isResyncing ? (
                    <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(invoice);
                }}
                className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                title="Edit invoice"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(invoice.id);
                }}
                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete invoice"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {(uploadError || isResyncing) && (
              <p className="text-xs text-red-600 mt-1 max-w-32 text-right">{uploadError}</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getCategoryColor()}`}>
            {getDescription()}
          </span>
          
          <div className="flex items-center gap-2">
            {invoice.file_type === 'pdf' ? (
              <FileText className="w-4 h-4 text-red-600" />
            ) : (
              <Image className="w-4 h-4 text-blue-600" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}