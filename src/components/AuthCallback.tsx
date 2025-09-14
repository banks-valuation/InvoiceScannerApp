import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MicrosoftService } from '../services/microsoftService';
import { AlertModal } from './Modal';
import { useAlertModal } from '../hooks/useModal';

export function AuthCallback() {
  const navigate = useNavigate();
  const alertModal = useAlertModal();
  
  useEffect(() => {
    const handleCallback = async () => {
      console.log('AuthCallback: Starting callback handling');
      console.log('Current URL:', window.location.href);
      
      // For implicit flow, tokens are in the URL fragment (hash)
      const urlParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = urlParams.get('access_token');
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      console.log('URL params:', { accessToken: accessToken ? 'present' : 'missing', error, errorDescription });
      if (error) {
        console.error('Authentication error:', error, errorDescription);
        alertModal.showAlert({
          title: 'Authentication Failed',
          message: `${error}${errorDescription ? `\n${errorDescription}` : ''}`,
          type: 'error'
        });
        navigate('/');
        return;
      }

      if (accessToken) {
        try {
          console.log('Processing access token...');
          await MicrosoftService.handleImplicitCallback(accessToken, urlParams);
          console.log('Authentication successful!');
          alertModal.showAlert({
            title: 'Connection Successful',
            message: 'Successfully connected to Microsoft OneDrive! You can now upload invoices to OneDrive and sync them to Excel.',
            type: 'success'
          });
          navigate('/');
        } catch (error) {
          console.error('Token processing failed:', error);
          alertModal.showAlert({
            title: 'Authentication Failed',
            message: `${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
            type: 'error'
          });
          navigate('/');
        }
      } else {
        console.log('No access token or error found, redirecting to home');
        // No token or error, redirect back
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Completing Microsoft authentication...</p>
        <p className="text-sm text-gray-500 mt-2">Please wait while we connect your account</p>
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