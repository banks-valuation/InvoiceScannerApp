import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, FileText, Settings, ChevronDown, ChevronRight, Calendar, CheckCircle, Cloud } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { InvoiceCard } from './InvoiceCard';
import { ConfirmModal, AlertModal } from './Modal';
import { useConfirmModal, useAlertModal } from '../hooks/useModal';
import { Invoice } from '../types/invoice';
import { InvoiceService } from '../services/invoiceService';
import { withTimeout } from '../lib/promiseUtils';

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

  const categories = ['All', 'Massage Therapy', 'Physio Therapy', 'Dentist', 'Prescription Medication', 'Vision', 'Other'];

  // Load invoices when user changes, with proper timeout
  useEffect(() => {
    if (!user) return;

    let didCancel = false;
    const timeoutId = setTimeout(() => {
      if (!didCancel) {
        console.warn('Loading invoices timed out, setting loading to false');
        setIsLoading(false);
      }
    }, 10000);

    const fetchInvoices = async () => {
      setIsLoading(true);
      try {
        console.log('Starting to load invoices...');
        const data = await withTimeout(InvoiceService.getInvoices(user.id), 30000);
        if (!didCancel) {
          console.log('Loaded invoices:', data.length);
          setInvoices(data);
        }
      } catch (error) {
        if (!didCancel) {
          console.error('Error loading invoices:', error);
          setInvoices([]);
          alertModal.showAlert({
            title: 'Loading Failed',
            message: 'Failed to load invoices. Please try refreshing the page.',
            type: 'error',
          });
        }
      } finally {
        if (!didCancel) setIsLoading(false);
      }
    };

    fetchInvoices();

    return () => {
      didCancel = true;
      clearTimeout(timeoutId);
    };
  }, [user]);

  // Listen for invoice updates from background sync
  useEffect(() => {
    const handleInvoiceUpdate = () => {
      if (user) {
        console.log('Invoice updated, reloading...');
        setIsLoading(true);
        InvoiceService.getInvoices(user.id)
          .then(data => setInvoices(data))
          .catch(err => {
            console.error(err);
            alertModal.showAlert({
              title: 'Update Failed',
              message: 'Failed to refresh invoices.',
              type: 'error'
            });
          })
          .finally(() => setIsLoading(false));
      }
    };

    window.addEventListener('invoiceUpdated', handleInvoiceUpdate);
    return () => window.removeEventListener('invoiceUpdated', handleInvoiceUpdate);
  }, [user]);

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

  // Filter invoices whenever invoices, searchTerm, or selectedCategory changes
  useEffect(() => {
    let filtered = invoices;

    if (searchTerm) {
      filtered = filtered.filter(inv =>
        inv.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'All') {
      filtered = filtered.filter(inv => inv.description_category === selectedCategory);
    }

    setFilteredInvoices(filtered);
  }, [invoices, searchTerm, selectedCategory]);

  // Group filtered invoices by year and month
  useEffect(() => {
    const grouped: Record<string, Record<string, Invoice[]>> = {};

    filteredInvoices.forEach(invoice => {
      try {
        const [year, month] = invoice.invoice_date.split('-');
        const yearKey = year;
        const monthKey = `${year}-${month}`;
        if (!grouped[yearKey]) grouped[yearKey] = {};
        if (!grouped[yearKey][monthKey]) grouped[yearKey][monthKey] = [];
        grouped[yearKey][monthKey].push(invoice);
      } catch (error) {
        console.error('Error parsing date for invoice:', invoice.id, invoice.invoice_date);
      }
    });

    const sortedGrouped: Record<string, Record<string, Invoice[]>> = {};
    Object.keys(grouped)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .forEach(year => {
        sortedGrouped[year] = {};
        Object.keys(grouped[year])
          .sort((a, b) => a.localeCompare(b))
          .forEach(month => {
            sortedGrouped[year][month] = grouped[year][month].sort((a, b) => b.invoice_date.localeCompare(a.invoice_date));
          });
      });

    setGroupedInvoices(sortedGrouped);

    // Auto-expand current year/month
    const currentYear = new Date().getFullYear().toString();
    const currentMonth = new Date().toISOString().slice(0, 7);
    if (sortedGrouped[currentYear]) {
      setExpandedYears(prev => new Set([...prev, currentYear]));
      if (sortedGrouped[currentYear][currentMonth]) {
        setExpandedMonths(prev => new Set([...prev, currentMonth]));
      }
    }
  }, [filteredInvoices]);

  // Toggle expanded state
  const toggleYear = (year: string) => {
    setExpandedYears(prev => {
      const newSet = new Set(prev);
      if (newSet.has(year)) {
        newSet.delete(year);
        Object.keys(groupedInvoices[year] || {}).forEach(month => {
          setExpandedMonths(prevMonths => {
            const newMonthSet = new Set(prevMonths);
            newMonthSet.delete(month);
            return newMonthSet;
          });
        });
      } else newSet.add(year);
      return newSet;
    });
  };

  const toggleMonth = (monthKey: string) => {
    setExpandedMonths(prev => {
      const newSet = new Set(prev);
      newSet.has(monthKey) ? newSet.delete(monthKey) : newSet.add(monthKey);
      return newSet;
    });
  };

  const getMonthName = (monthKey: string) => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('en-US', { month: 'short' });
  };

  const getMonthTotal = (invoices: Invoice[]) => invoices.reduce((sum, i) => sum + i.invoice_amount, 0);
  const getYearTotal = (yearData: Record<string, Invoice[]>) => Object.values(yearData).flat().reduce((sum, i) => sum + i.invoice_amount, 0);
  const getTotalAmount = () => filteredInvoices.reduce((sum, i) => sum + i.invoice_amount, 0);

  // Delete invoice
  const handleDelete = async (id: string) => {
    const invoice = invoices.find(inv => inv.id === id);
    confirmModal.showConfirm({
      title: 'Delete Invoice',
      message: `Are you sure you want to delete the invoice for ${invoice?.customer_name || 'this customer'}?`,
      confirmText: 'Delete',
      type: 'error',
      onConfirm: async () => {
        try {
          if (invoice?.file_url) await InvoiceService.deleteFile(invoice.file_url);
          await InvoiceService.deleteInvoice(id, user!.id);
          setInvoices(prev => prev.filter(inv => inv.id !== id));
        } catch (error) {
          console.error('Error deleting invoice:', error);
          alertModal.showAlert({ title: 'Delete Failed', message: 'Failed to delete the invoice.', type: 'error' });
        }
      }
    });
  };

  // Update invoice
  const handleInvoiceUpdate = (updatedInvoice: Invoice) => {
    setInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));
    setFilteredInvoices(prev => prev.map(inv => inv.id === updatedInvoice.id ? updatedInvoice : inv));
  };

  // Sync all month
  const handleSyncAllMonth = async (monthKey: string, monthInvoices: Invoice[]) => {
    const unsyncedInvoices = monthInvoices.filter(i => !i.onedrive_uploaded);
    if (unsyncedInvoices.length === 0) {
      alertModal.showAlert({ title: 'Already Synced', message: 'All invoices in this month are already synced.', type: 'info' });
      return;
    }

    confirmModal.showConfirm({
      title: 'Sync to OneDrive',
      message: `Sync ${unsyncedInvoices.length} unsynced invoices from ${getMonthName(monthKey)}?`,
      confirmText: 'Sync All',
      type: 'info',
      onConfirm: async () => {
        setSyncingMonths(prev => new Set([...prev, monthKey]));
        let successCount = 0, failureCount = 0;
        const errors: string[] = [];

        for (const invoice of unsyncedInvoices) {
          try {
            const result = await InvoiceService.uploadToOneDrive(invoice);
            if (result.success) {
              successCount++;
              setInvoices(prev => prev.map(inv => inv.id === invoice.id ? { ...inv, onedrive_uploaded: true, onedrive_file_url: result.fileUrl, excel_synced: true } : inv));
            } else {
              failureCount++;
              errors.push(`${invoice.customer_name}: ${result.error}`);
            }
          } catch (error) {
            failureCount++;
            errors.push(`${invoice.customer_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        let message = `Successfully synced: ${successCount} invoices`;
        if (failureCount > 0) {
          message += `\nFailed: ${failureCount} invoices`;
          if (errors.length > 0) message += `\n\nErrors:\n${errors.slice(0, 3).join('\n')}${errors.length > 3 ? `\n...and ${errors.length - 3} more` : ''}`;
        }

        alertModal.showAlert({ title: 'Sync Complete', message, type: failureCount > 0 ? 'warning' : 'success' });
        setSyncingMonths(prev => { const newSet = new Set(prev); newSet.delete(monthKey); return newSet; });
      }
    });
  };

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
      {/* Header, Filters, and Invoice Groups */}
      {/* ...Keep the rest of your JSX mostly unchanged from your original code... */}
    </div>
  );
}
