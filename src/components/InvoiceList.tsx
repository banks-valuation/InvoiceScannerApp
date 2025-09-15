import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, FileText, Settings, ChevronDown, ChevronRight, Calendar, DollarSign, Cloud, CheckCircle } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { InvoiceCard } from './InvoiceCard';
import { ConfirmModal, AlertModal } from './Modal';
import { useConfirmModal, useAlertModal } from '../hooks/useModal';
import { Invoice } from '../types/invoice';
import { InvoiceService } from '../services/invoiceService';

interface InvoiceListProps {
  onAddInvoice: () => void;
  onEditInvoice: (invoice: Invoice) => void;
  onShowSettings: () => void;
}

export function InvoiceList({ onAddInvoice, onEditInvoice, onShowSettings }: InvoiceListProps) {
  const { signOut, user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<Invoice[]>([]);
  const [groupedInvoices, setGroupedInvoices] = useState<Record<string, Record<string, Invoice[]>>>({});
  const [expandedYears, setExpandedYears] = useState<Set<string>>(new Set());
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isLoading, setIsLoading] = useState(true);
  const [syncingMonths, setSyncingMonths] = useState<Set<string>>(new Set());
  const confirmModal = useConfirmModal();
  const alertModal = useAlertModal();

  useEffect(() => {
    if (user) {
      loadInvoices();
    }
  }, [user]);

   // Listen for invoice updates from background sync
   useEffect(() => {
     const handleInvoiceUpdate = () => {
       loadInvoices();
     };

     window.addEventListener('invoiceUpdated', handleInvoiceUpdate);
     return () => window.removeEventListener('invoiceUpdated', handleInvoiceUpdate);
   }, []);

  // Add timeout for loading state
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.warn('Loading invoices timed out, setting loading to false');
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Clear invoices when user signs out
  useEffect(() => {
    if (!user) {
      setInvoices([]);
      setFilteredInvoices([]);
      setGroupedInvoices({});
      setSearchTerm('');
      setSelectedCategory('All');
    }
  }, [user]);

  useEffect(() => {
    filterInvoices();
  }, [invoices, searchTerm, selectedCategory]);

  useEffect(() => {
    groupInvoicesByDate();
  }, [filteredInvoices]);

  const loadInvoices = async () => {
    if (!user) {
      console.log('No user available, skipping invoice load');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting to load invoices...');
      const data = await InvoiceService.getInvoices(user.id);
      console.log('Loaded invoices:', data.length);
      setInvoices(data);
    } catch (error) {
      console.error('Error loading invoices:', error);
      // Show error to user instead of staying stuck
      alertModal.showAlert({
        title: 'Loading Failed',
        message: 'Failed to load invoices. Please try refreshing the page.',
        type: 'error'
      });
      // Set empty array so UI doesn't stay in loading state
      setInvoices([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterInvoices = () => {
    let filtered = invoices;

    if (searchTerm) {
      filtered = filtered.filter(invoice =>
        invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(invoice => invoice.description_category === selectedCategory);
    }

    setFilteredInvoices(filtered);
  };

  const groupInvoicesByDate = () => {
    const grouped: Record<string, Record<string, Invoice[]>> = {};
    
    filteredInvoices.forEach(invoice => {
      try {
        const [year, month] = invoice.invoice_date.split('-');
        const yearKey = year;
        const monthKey = `${year}-${month}`;
        
        if (!grouped[yearKey]) {
          grouped[yearKey] = {};
        }
        if (!grouped[yearKey][monthKey]) {
          grouped[yearKey][monthKey] = [];
        }
        
        grouped[yearKey][monthKey].push(invoice);
      } catch (error) {
        console.error('Error parsing date for invoice:', invoice.id, invoice.invoice_date);
      }
    });
    
    // Sort years and months
    const sortedGrouped: Record<string, Record<string, Invoice[]>> = {};
    Object.keys(grouped)
      .sort((a, b) => parseInt(b) - parseInt(a)) // Newest year first
      .forEach(year => {
        sortedGrouped[year] = {};
        Object.keys(grouped[year])
          .sort((a, b) => b.localeCompare(a)) // Newest month first
          .forEach(month => {
            // Sort invoices within month by date (newest first)
            sortedGrouped[year][month] = grouped[year][month].sort((a, b) => 
              a.invoice_date.localeCompare(b.invoice_date)
            );
          });
      });
    
    setGroupedInvoices(sortedGrouped);
    
    // Auto-expand current year and month
    const currentYear = new Date().getFullYear().toString();
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    
    if (sortedGrouped[currentYear]) {
      setExpandedYears(prev => new Set([...prev, currentYear]));
      if (sortedGrouped[currentYear][currentMonth]) {
        setExpandedMonths(prev => new Set([...prev, currentMonth]));
      }
    }
  };

  const toggleYear = (year: string) => {
    setExpandedYears(prev => {
      const newSet = new Set(prev);
      if (newSet.has(year)) {
        newSet.delete(year);
        // Also collapse all months in this year
        Object.keys(groupedInvoices[year] || {}).forEach(month => {
          setExpandedMonths(prevMonths => {
            const newMonthSet = new Set(prevMonths);
            newMonthSet.delete(month);
            return newMonthSet;
          });
        });
      } else {
        newSet.add(year);
      }
      return newSet;
    });
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      if (newSet.has(monthKey)) {
        newSet.delete(monthKey);
      } else {
        newSet.add(monthKey);
      }
      return newSet;
    });
  };

  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  const getMonthTotal = (invoices: Invoice[]) => {
    return invoices.reduce((sum, invoice) => sum + invoice.invoice_amount, 0);
  };

  const getYearTotal = (yearData: Record<string, Invoice[]>) => {
    return Object.values(yearData).flat().reduce((sum, invoice) => sum + invoice.invoice_amount, 0);
  };

  const handleDelete = async (id: string) => {
    const invoice = invoices.find(inv => inv.id === id);
    
    confirmModal.showConfirm({
      title: 'Delete Invoice',
      message: `Are you sure you want to delete the invoice for ${invoice?.customer_name || 'this customer'}? This action cannot be undone.`,
      confirmText: 'Delete',
      type: 'error',
      onConfirm: async () => {
        try {
          // Find the invoice to get the file path for cleanup
          if (invoice?.file_url) {
            await InvoiceService.deleteFile(invoice.file_url);
          }
          
          await InvoiceService.deleteInvoice(id, user!.id);
          setInvoices(prev => prev.filter(invoice => invoice.id !== id));
        } catch (error) {
          console.error('Error deleting invoice:', error);
          alertModal.showAlert({
            title: 'Delete Failed',
            message: 'Failed to delete the invoice. Please try again.',
            type: 'error'
          });
        }
      }
    });
  };

  const handleInvoiceUpdate = (updatedInvoice: Invoice) => {
    setInvoices(prev => prev.map(inv => 
      inv.id === updatedInvoice.id ? updatedInvoice : inv
    ));
    // Force re-render by updating the filtered invoices as well
    setFilteredInvoices(prev => prev.map(inv => 
      inv.id === updatedInvoice.id ? updatedInvoice : inv
    ));
  };

  const handleSyncAllMonth = async (monthKey: string, monthInvoices: Invoice[]) => {
    // Only sync invoices that haven't been uploaded to OneDrive yet
    const unsyncedInvoices = monthInvoices.filter(invoice => !invoice.onedrive_uploaded);
    
    if (unsyncedInvoices.length === 0) {
      alertModal.showAlert({
        title: 'Already Synced',
        message: 'All invoices in this month are already synced to OneDrive.',
        type: 'info'
      });
      return;
    }

    confirmModal.showConfirm({
      title: 'Sync to OneDrive',
      message: `Sync ${unsyncedInvoices.length} unsynced invoices from ${getMonthName(monthKey)} to OneDrive and Excel?`,
      confirmText: 'Sync All',
      type: 'info',
      onConfirm: async () => {
        setSyncingMonths(prev => new Set([...prev, monthKey]));

        let successCount = 0;
        let failureCount = 0;
        const errors: string[] = [];

        try {
          // Process invoices one by one to avoid overwhelming the API
          for (const invoice of unsyncedInvoices) {
            try {
              const result = await InvoiceService.uploadToOneDrive(invoice);
              if (result.success) {
                successCount++;
                // Update the local state to reflect the sync
                setInvoices(prev => prev.map(inv => 
                  inv.id === invoice.id 
                    ? { ...inv, onedrive_uploaded: true, onedrive_file_url: result.fileUrl, excel_synced: true }
                    : inv
                ));
              } else {
                failureCount++;
                errors.push(`${invoice.customer_name}: ${result.error}`);
              }
            } catch (error) {
              failureCount++;
              errors.push(`${invoice.customer_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
            
            // Small delay between uploads to be respectful to the API
            await new Promise(resolve => setTimeout(resolve, 500));
          }

          // Show results
          let message = `Successfully synced: ${successCount} invoices`;
          if (failureCount > 0) {
            message += `\nFailed to sync: ${failureCount} invoices`;
            if (errors.length > 0) {
              message += `\n\nErrors:\n${errors.slice(0, 3).join('\n')}`;
              if (errors.length > 3) {
                message += `\n... and ${errors.length - 3} more errors`;
              }
            }
          }
          
          alertModal.showAlert({
            title: 'Sync Complete',
            message,
            type: failureCount > 0 ? 'warning' : 'success'
          });
        } catch (error) {
          console.error('Batch sync error:', error);
          alertModal.showAlert({
            title: 'Sync Failed',
            message: `Batch sync failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            type: 'error'
          });
        } finally {
          setSyncingMonths(prev => {
            const newSet = new Set(prev);
            newSet.delete(monthKey);
            return newSet;
          });
        }
      }
    });
  };

  const getTotalAmount = () => {
    return filteredInvoices.reduce((sum, invoice) => sum + invoice.invoice_amount, 0);
  };

  const categories = ['All', 'Massage Therapy', 'Physio Therapy', 'Dentist', 'Prescription Medication', 'Vision', 'Other'];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading invoices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Invoice Manager</h1>
              <p className="text-gray-600 mt-1">
                {filteredInvoices.length} invoices • Total: {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(getTotalAmount())}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={onShowSettings}
                className="p-3 text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                title="Settings"
              >
                <Settings className="w-6 h-6" />
              </button>
              <button
                onClick={signOut}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Sign Out"
              >
                Sign Out
              </button>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by customer name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
            </div>
            
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-10 pr-8 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
              >
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {filteredInvoices.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchTerm || selectedCategory !== 'All' ? 'No matching invoices' : 'No invoices yet'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchTerm || selectedCategory !== 'All' 
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by adding your first invoice.'}
            </p>
            {(!searchTerm && selectedCategory === 'All') && (
              <button
                onClick={onAddInvoice}
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Add Your First Invoice
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedInvoices).map(([year, yearData]) => (
              <div key={year} className="bg-white rounded-xl shadow-sm border">
                <button
                  onClick={() => toggleYear(year)}
                  className="w-full flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {expandedYears.has(year) ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    )}
                    <div className="flex items-center gap-3">
                      <Calendar className="w-6 h-6 text-blue-600" />
                      <h2 className="text-xl font-bold text-gray-900">{year}</h2>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-xl font-bold text-green-600">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(getYearTotal(yearData))}
                    </span>
                    <span className="text-sm text-gray-500 ml-2">
                      ({Object.values(yearData).flat().length})
                    </span>
                  </div>
                </button>

                {expandedYears.has(year) && (
                  <div className="border-t">
                    {Object.entries(yearData).map(([monthKey, monthInvoices]) => (
                      <div key={monthKey} className="border-b last:border-b-0">
                        <button
                          onClick={() => toggleMonth(monthKey)}
                          className="w-full flex items-center justify-between p-4 pl-16 hover:bg-gray-50 transition-colors group"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            {expandedMonths.has(monthKey) ? (
                              <ChevronDown className="w-4 h-4 text-gray-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            )}
                            <h3 className="text-lg font-semibold text-gray-800 truncate">
                              {getMonthName(monthKey)}
                            </h3>
                            {monthInvoices.every(inv => inv.onedrive_uploaded) && (
                              <div className="hidden sm:flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                                <CheckCircle className="w-3 h-3" />
                                All Synced
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
                            {/* Sync All Button */}
                            {monthInvoices.some(inv => !inv.onedrive_uploaded) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSyncAllMonth(monthKey, monthInvoices);
                                }}
                                disabled={syncingMonths.has(monthKey)}
                                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                                  syncingMonths.has(monthKey)
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                    : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                }`}
                                title={`Sync all unsynced invoices in ${getMonthName(monthKey)}`}
                              >
                                {syncingMonths.has(monthKey) ? (
                                  <>
                                    <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                                    <span className="hidden sm:inline">Syncing...</span>
                                  </>
                                ) : (
                                  <>
                                    <Cloud className="w-3 h-3" />
                                    <span className="hidden sm:inline">Sync All</span>
                                    <span className="sm:hidden">Sync</span>
                                    <span>({monthInvoices.filter(inv => !inv.onedrive_uploaded).length})</span>
                                  </>
                                )}
                              </button>
                            )}
                            
                            {/* Month Total */}
                            <div className="text-right flex-shrink-0">
                              <span className="text-sm sm:text-lg font-bold text-blue-600">
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                              }).format(getMonthTotal(monthInvoices))}
                              </span>
                              <span className="text-xs sm:text-sm text-gray-500 ml-1">
                              ({monthInvoices.length})
                              </span>
                            </div>
                          </div>
                        </button>

                        {expandedMonths.has(monthKey) && (
                          <div className="p-4 pl-16 bg-gray-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {monthInvoices.map(invoice => (
                                <InvoiceCard
                                  key={invoice.id}
                                  invoice={invoice}
                                  onEdit={onEditInvoice}
                                  onDelete={handleDelete}
                                  onInvoiceUpdate={handleInvoiceUpdate}
                                />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fixed bottom buttons */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-10">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-center">
            <button
              onClick={onAddInvoice}
              className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium shadow-sm"
            >
              <Plus className="w-5 h-5" />
              Add Invoice
            </button>
          </div>
        </div>
      </div>

      {/* Add bottom padding to prevent content from being hidden behind fixed buttons */}
      <div className="h-20"></div>

      {/* Modals */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={confirmModal.handleClose}
        onConfirm={confirmModal.handleConfirm}
        title={confirmModal.config?.title || ''}
        message={confirmModal.config?.message || ''}
        confirmText={confirmModal.config?.confirmText}
        cancelText={confirmModal.config?.cancelText}
        type={confirmModal.config?.type}
        isLoading={confirmModal.isLoading}
      />

      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={alertModal.handleClose}
        title={alertModal.config?.title || ''}
        message={alertModal.config?.message || ''}
        type={alertModal.config?.type}
      />
    </div>
  );
}