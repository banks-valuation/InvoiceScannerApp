import React, { useState } from 'react';
import { Save, ArrowLeft, Zap } from 'lucide-react';
import { AlertModal } from './Modal';
import { useAlertModal } from '../hooks/useModal';
import { FileUpload } from './FileUpload';
import { InvoiceFormData, Invoice } from '../types/invoice';
import { OCRService } from '../services/ocrService';
import { SettingsService } from '../services/settingsService';

interface InvoiceFormProps {
  invoice?: Invoice | null;
  onSubmit: (data: InvoiceFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

const DESCRIPTION_OPTIONS = [
  'Massage Therapy',
  'Physio Therapy', 
  'Dental',
  'Prescription Medication',
  'Vision',
  'Other'
] as const;

export function InvoiceForm({ invoice, onSubmit, onCancel, isLoading }: InvoiceFormProps) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  
  const [formData, setFormData] = useState<InvoiceFormData>({
    customer_name: invoice?.customer_name || '',
    invoice_date: invoice?.invoice_date || '',
    invoice_amount: invoice?.invoice_amount?.toString() || '',
    description_category: invoice?.description_category || settings.general.defaultCategory,
    description_other: invoice?.description_other || '',
  });
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const alertModal = useAlertModal();

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await SettingsService.getSettings();
        setSettings(loadedSettings);
        
        // Update form data with loaded default category if this is a new invoice
        if (!invoice) {
          setFormData(prev => ({
            ...prev,
            description_category: loadedSettings.general.defaultCategory,
          }));
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };

    loadSettings();
  }, [invoice]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.customer_name.trim()) {
      newErrors.customer_name = 'Customer name is required';
    }
    
    if (!formData.invoice_date) {
      newErrors.invoice_date = 'Invoice date is required';
    }
    
    if (!formData.invoice_amount || parseFloat(formData.invoice_amount) <= 0) {
      newErrors.invoice_amount = 'Valid invoice amount is required';
    }
    
    if (formData.description_category === 'Other' && !formData.description_other?.trim()) {
      newErrors.description_other = 'Please specify the description';
    }
    
    if (!selectedFile && !invoice) {
      newErrors.file = 'Invoice image or PDF is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    try {
      await onSubmit({
        ...formData,
        file: selectedFile || undefined,
      });
    } catch (error) {
      console.error('Error saving invoice:', error);
      alertModal.showAlert({
        title: 'Save Failed',
        message: 'Error saving invoice. Please try again.',
        type: 'error'
      });
    }
  };

  const handleInputChange = (field: keyof InvoiceFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleFileSelect = async (file: File) => {
    setSelectedFile(file);
    
    // Only run OCR if auto-extraction is enabled
    if (settings.general.autoExtractOCR) {
      setIsExtracting(true);
      setExtractionStatus('idle');
      
      try {
        const extractedData = await OCRService.extractInvoiceData(file);
        
        // Update form data with extracted information
        setFormData(prev => ({
          ...prev,
          customer_name: extractedData.customer_name || prev.customer_name,
          invoice_date: extractedData.invoice_date || prev.invoice_date,
          invoice_amount: extractedData.invoice_amount || prev.invoice_amount,
        }));
        
        setExtractionStatus('success');
        
        // Clear any existing errors for fields that were successfully extracted
        const newErrors = { ...errors };
        if (extractedData.customer_name) delete newErrors.customer_name;
        if (extractedData.invoice_date) delete newErrors.invoice_date;
        if (extractedData.invoice_amount) delete newErrors.invoice_amount;
        setErrors(newErrors);
        
      } catch (error) {
        console.error('OCR extraction failed:', error);
        setExtractionStatus('error');
      } finally {
        setIsExtracting(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
            <div className="flex items-center gap-4">
              <button
                onClick={onCancel}
                className="p-2 hover:bg-blue-500 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h1 className="text-xl font-semibold text-white">
                {invoice ? 'Edit Invoice' : 'Add New Invoice'}
              </h1>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div className="relative">
              {isExtracting && (
                <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10 rounded-xl">
                  <div className="text-center">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-sm font-medium text-gray-700">Extracting invoice data...</p>
                    <p className="text-xs text-gray-500 mt-1">Please wait while we process your document</p>
                  </div>
                </div>
              )}
              
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700">
                  {invoice ? 'Replace Invoice Document (Optional)' : 'Invoice Document'}
                </label>
                {isExtracting && (
                  <div className="flex items-center gap-2 text-sm text-blue-600">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    Extracting data...
                  </div>
                )}
                {extractionStatus === 'success' && (
                  <div className="flex items-center gap-2 text-sm text-green-600">
                    <Zap className="w-4 h-4" />
                    Data extracted successfully!
                  </div>
                )}
                {extractionStatus === 'error' && (
                  <div className="flex items-center gap-2 text-sm text-amber-600">
                    <Zap className="w-4 h-4" />
                    Extraction failed, please fill manually
                  </div>
                )}
              </div>
              <FileUpload
                onFileSelect={handleFileSelect}
                selectedFile={selectedFile}
                onClearFile={() => setSelectedFile(null)}
                existingFileUrl={invoice?.file_url}
              />
              {errors.file && !invoice && (
                <p className="mt-2 text-sm text-red-600">{errors.file}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name
                </label>
                <input
                  type="text"
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => handleInputChange('customer_name', e.target.value)}
                  disabled={isExtracting}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    isExtracting ? 'bg-gray-50 cursor-not-allowed' :
                    errors.customer_name ? 'border-red-300' : 
                    (extractionStatus === 'success' && formData.customer_name) ? 'border-green-300 bg-green-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter customer name"
                />
                {errors.customer_name && (
                  <p className="mt-1 text-sm text-red-600">{errors.customer_name}</p>
                )}
              </div>

              <div>
                <label htmlFor="invoice_date" className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Date
                </label>
                <input
                  type="date"
                  id="invoice_date"
                  value={formData.invoice_date}
                  onChange={(e) => handleInputChange('invoice_date', e.target.value)}
                  disabled={isExtracting}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    isExtracting ? 'bg-gray-50 cursor-not-allowed' :
                    errors.invoice_date ? 'border-red-300' : 
                    (extractionStatus === 'success' && formData.invoice_date) ? 'border-green-300 bg-green-50' : 'border-gray-300'
                  }`}
                />
                {errors.invoice_date && (
                  <p className="mt-1 text-sm text-red-600">{errors.invoice_date}</p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="invoice_amount" className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Amount
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  id="invoice_amount"
                  step="0.01"
                  value={formData.invoice_amount}
                  onChange={(e) => handleInputChange('invoice_amount', e.target.value)}
                  disabled={isExtracting}
                  className={`w-full pl-8 pr-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    isExtracting ? 'bg-gray-50 cursor-not-allowed' :
                    errors.invoice_amount ? 'border-red-300' : 
                    (extractionStatus === 'success' && formData.invoice_amount) ? 'border-green-300 bg-green-50' : 'border-gray-300'
                  }`}
                  placeholder="0.00"
                />
              </div>
              {errors.invoice_amount && (
                <p className="mt-1 text-sm text-red-600">{errors.invoice_amount}</p>
              )}
            </div>

            <div>
              <label htmlFor="description_category" className="block text-sm font-medium text-gray-700 mb-2">
                Description Category
              </label>
              <select
                id="description_category"
                value={formData.description_category}
                onChange={(e) => handleInputChange('description_category', e.target.value)}
                disabled={isExtracting}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              >
                {DESCRIPTION_OPTIONS.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {formData.description_category === 'Other' && (
              <div>
                <label htmlFor="description_other" className="block text-sm font-medium text-gray-700 mb-2">
                  Specify Description
                </label>
                <input
                  type="text"
                  id="description_other"
                  value={formData.description_other}
                  onChange={(e) => handleInputChange('description_other', e.target.value)}
                  disabled={isExtracting}
                  className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors ${
                    isExtracting ? 'bg-gray-50 cursor-not-allowed' :
                    errors.description_other ? 'border-red-300' : 'border-gray-300'
                  }`}
                  placeholder="Enter custom description"
                />
                {errors.description_other && (
                  <p className="mt-1 text-sm text-red-600">{errors.description_other}</p>
                )}
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || isExtracting}
                className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              >
                {isLoading || isExtracting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                
                {isLoading ? 'Saving...' : isExtracting ? 'Processing...' : invoice ? 'Update Invoice' : 'Save Invoice'}
              </button>
            </div>
            </div>
          </form>
        </div>
      </div>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={alertModal.handleClose}
        title={alertModal.config?.title || ''}
        message={alertModal.config?.message || ''}
        type={alertModal.config?.type}
        buttonText={alertModal.config?.buttonText}
      />
    </div>
  );
}