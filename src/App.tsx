import React, { useState } from 'react';
import { AuthProvider } from './components/AuthProvider';
import { InvoiceList } from './components/InvoiceList';
import { InvoiceForm } from './components/InvoiceForm';
import { SettingsPage } from './components/SettingsPage';
import { AlertModal } from './components/Modal';
import { useAlertModal } from './hooks/useModal';
import { InvoiceService } from './services/invoiceService';
import { MicrosoftService } from './services/microsoftService';
import { InvoiceFormData, Invoice } from './types/invoice';

type AppView = 'list' | 'add' | 'edit' | 'settings';

function App() {
  const [currentView, setCurrentView] = useState<AppView>('list');
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const alertModal = useAlertModal();

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
      let savedInvoice: Invoice;
      
      if (editingInvoice) {
        savedInvoice = await InvoiceService.updateInvoice(editingInvoice.id, formData);
        console.log('Invoice updated:', savedInvoice);
        
        // If the invoice was previously synced to OneDrive/Excel, resync the changes
        if (savedInvoice.onedrive_uploaded && savedInvoice.excel_synced) {
          try {
            await InvoiceService.resyncToExcel(savedInvoice);
            console.log('Invoice changes resynced to Excel');
          } catch (error) {
            console.error('Failed to resync to Excel:', error);
            // Don't fail the whole operation if Excel sync fails
          }
        }
      } else {
        savedInvoice = await InvoiceService.createInvoice(formData);
        console.log('Invoice created:', savedInvoice);
      }
      
      // Auto-sync to OneDrive if Microsoft is connected
      if (MicrosoftService.isAuthenticated()) {
        try {
          console.log('Microsoft is connected, auto-syncing to OneDrive...');
          const syncResult = await InvoiceService.uploadToOneDrive(savedInvoice);
          if (syncResult.success) {
            console.log('Auto-sync to OneDrive successful');
          } else {
            console.warn('Auto-sync to OneDrive failed:', syncResult.error);
            // Show a non-blocking warning but don't fail the save operation
            alertModal.showAlert({
              title: 'Sync Warning',
              message: `Invoice saved successfully, but auto-sync to OneDrive failed: ${syncResult.error}`,
              type: 'warning'
            });
          }
        } catch (error) {
          console.error('Auto-sync error:', error);
          // Show a non-blocking warning but don't fail the save operation
          alertModal.showAlert({
            title: 'Sync Warning',
            message: 'Invoice saved successfully, but auto-sync to OneDrive encountered an error.',
            type: 'warning'
          });
        }
      }
      
      setEditingInvoice(null);
      setCurrentView('list');
    } catch (error) {
      console.error('Error saving invoice:', error);
      alertModal.showAlert({
        title: 'Save Failed',
        message: 'Error saving invoice. Please try again.',
        type: 'error'
      });
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
        alertModal={alertModal}
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
  alertModal: ReturnType<typeof useAlertModal>;
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
  alertModal,
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
    <>
      <InvoiceList 
        onAddInvoice={onAddInvoice} 
        onEditInvoice={onEditInvoice}
        onShowSettings={onShowSettings}
      />
      
      {/* Global Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        onClose={alertModal.handleClose}
        title={alertModal.config?.title || ''}
        message={alertModal.config?.message || ''}
        type={alertModal.config?.type}
        buttonText={alertModal.config?.buttonText}
      />
    </>
  );
}

export default App;