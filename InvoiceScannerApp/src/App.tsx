import React, { useState } from 'react';
import { AuthProvider } from './components/AuthProvider';
import { InvoiceList } from './components/InvoiceList';
import { InvoiceForm } from './components/InvoiceForm';
import { SettingsPage } from './components/SettingsPage';
import { InvoiceService } from './services/invoiceService';
import { InvoiceFormData, Invoice } from './types/invoice';

type AppView = 'list' | 'add' | 'edit' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('list');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddInvoice = () => {
    setEditingInvoice(null);
    setCurrentView('add');
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setCurrentView('edit');
  };

  const handleShowSettings = () => {
    setCurrentView('settings');
  };

  const handleCancelAdd = () => {
    setEditingInvoice(null);
    setCurrentView('list');
  };

  const handleBackToList = () => {
    setEditingInvoice(null);
    setCurrentView('list');
  };

  const handleSubmitInvoice = async (formData: InvoiceFormData) => {
    setIsSubmitting(true);
    try {
      if (editingInvoice) {
        const updatedInvoice = await InvoiceService.updateInvoice(editingInvoice.id, formData);
        console.log('Invoice updated:', updatedInvoice);
        
        // If the invoice was previously synced to OneDrive/Excel, resync the changes
        if (updatedInvoice.onedrive_uploaded && updatedInvoice.excel_synced) {
          try {
            await InvoiceService.resyncToExcel(updatedInvoice);
            console.log('Invoice changes resynced to Excel');
          } catch (error) {
            console.error('Failed to resync to Excel:', error);
            // Don't fail the whole operation if Excel sync fails
          }
        }
      } else {
        const newInvoice = await InvoiceService.createInvoice(formData);
        console.log('Invoice created:', newInvoice);
      }
      
      // Note: OneDrive and Excel integration would happen here when configured
      
      setEditingInvoice(null);
      setCurrentView('list');
    } catch (error) {
      console.error('Error saving invoice:', error);
      alert('Error saving invoice. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthProvider>
      <AppContent
        currentView={currentView}
        editingInvoice={editingInvoice}
        isSubmitting={isSubmitting}
        onAddInvoice={handleAddInvoice}
        onEditInvoice={handleEditInvoice}
        onShowSettings={handleShowSettings}
        onBackToList={handleBackToList}
        onSubmitInvoice={handleSubmitInvoice}
      />
    </AuthProvider>
  );
}

interface AppContentProps {
  currentView: AppView;
  editingInvoice: Invoice | null;
  isSubmitting: boolean;
  onAddInvoice: () => void;
  onEditInvoice: (invoice: Invoice) => void;
  onShowSettings: () => void;
  onBackToList: () => void;
  onSubmitInvoice: (formData: InvoiceFormData) => Promise<void>;
}

function AppContent({
  currentView,
  editingInvoice,
  isSubmitting,
  onAddInvoice,
  onEditInvoice,
  onShowSettings,
  onBackToList,
  onSubmitInvoice
}: AppContentProps) {
  if (currentView === 'settings') {
    return <SettingsPage onBack={onBackToList} />;
  }

  if (currentView === 'add' || currentView === 'edit') {
    return (
      <InvoiceForm
        invoice={editingInvoice}
        onSubmit={onSubmitInvoice}
        onCancel={onBackToList}
        isLoading={isSubmitting}
      />
    );
  }

  return (
    <InvoiceList 
      onAddInvoice={onAddInvoice} 
      onEditInvoice={onEditInvoice}
      onShowSettings={onShowSettings}
    />
  );
}

export default App;