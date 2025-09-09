import { useState } from 'react';

export function useModal() {
  const [isOpen, setIsOpen] = useState(false);

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  return {
    isOpen,
    openModal,
    closeModal,
  };
}

export function useConfirmModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const showConfirm = (options: {
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
    confirmText?: string;
    cancelText?: string;
    type?: 'info' | 'success' | 'warning' | 'error';
  }) => {
    setConfig(options);
    setIsOpen(true);
  };

  const handleConfirm = async () => {
    if (!config) return;
    
    setIsLoading(true);
    try {
      await config.onConfirm();
      setIsOpen(false);
    } catch (error) {
      console.error('Confirm action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setIsOpen(false);
      setConfig(null);
    }
  };

  return {
    isOpen,
    config,
    isLoading,
    showConfirm,
    handleConfirm,
    handleClose,
  };
}

export function useAlertModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [config, setConfig] = useState<{
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    buttonText?: string;
  } | null>(null);

  const showAlert = (options: {
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    buttonText?: string;
  }) => {
    setConfig(options);
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
    setConfig(null);
  };

  return {
    isOpen,
    config,
    showAlert,
    handleClose,
  };
}