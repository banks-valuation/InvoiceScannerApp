import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MicrosoftService } from '../services/microsoftService';
import { AlertModal } from './Modal';
import { useAlertModal } from '../hooks/useModal';

export function AuthCallback() {
  const navigate = useNavigate();
  const alertModal = useAlertModal();
  const [isProcessing, setIsProcessing] = useState(true);
  
  useEffect(() => {
    const handleCallback = async () => {
      setIsProcessing(true);
      console.log('AuthCallback: Starting callback handling');
      console.log('Current URL:', window.location.href);
      
      // Check for authorization code (new flow) or access token (legacy flow)
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');

      // Also check hash for legacy implicit flow
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get('access_token');

      console.log('URL params:', { 
        code: code ? 'present' : 'missing', 
        accessToken: accessToken ? 'present' : 'missing', 
        error, 
        errorDescription 
      });
      
      if (error) {
        console.error('Authentication error:', error, errorDescription);
        alertModal.showAlert({
          title: 'Authentication Failed',
          message: `${error}${errorDescription ? `\n${errorDescription}` : ''}\n\nYou can manually connect to OneDrive later from the Settings page.`,
          type: 'error'
        });
        // Add a delay before navigating to ensure the alert is shown
        setTimeout(() => {
          setIsProcessing(false);
          navigate('/');
        }, 2000);
        return;
      }

      if (code) {
        // New authorization code flow
        try {
          console.log('Processing authorization code...');
          await MicrosoftService.handleAuthorizationCallback(code);
          console.log('Authentication successful!');
          alertModal.showAlert({
            title: 'OneDrive Connected!',
            message: 'Successfully connected to Microsoft OneDrive! Your invoices will now automatically sync to OneDrive and Excel.',
            type: 'success'
          });
          // Add a delay before navigating to show the success message
          setTimeout(() => {
            setIsProcessing(false);
            navigate('/');
          }, 2000);
        } catch (error) {
          console.error('Authorization code processing failed:', error);
          alertModal.showAlert({
            title: 'OneDrive Connection Failed',
            message: `${error instanceof Error ? error.message : 'Unknown error'}. You can try connecting again from the Settings page.`,
            type: 'error'
          });
          setTimeout(() => {
            setIsProcessing(false);
            navigate('/');
          }, 2000);
        }
      } else if (accessToken) {
        // Legacy implicit flow
        try {
          console.log('Processing access token...');
          await MicrosoftService.handleImplicitCallback(accessToken, hashParams);
          console.log('Authentication successful!');
          alertModal.showAlert({
            title: 'OneDrive Connected!',
            message: 'Successfully connected to Microsoft OneDrive! Your invoices will now automatically sync to OneDrive and Excel.',
            type: 'success'
          });
          setTimeout(() => {
            setIsProcessing(false);
            navigate('/');
          }, 2000);
        } catch (error) {
          console.error('Token processing failed:', error);
          alertModal.showAlert({
            title: 'OneDrive Connection Failed',
            message: `${error instanceof Error ? error.message : 'Unknown error'}. You can try connecting again from the Settings page.`,
            type: 'error'
          });
          setTimeout(() => {
            setIsProcessing(false);
            navigate('/');
          }, 2000);
        }
      } else {
        console.log('No authorization code or access token found, redirecting to home');
        setIsProcessing(false);
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        {isProcessing ? (
          <>
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Connecting to OneDrive...</p>
            <p className="text-sm text-gray-500 mt-2">Please wait while we set up your cloud storage</p>
          </>
        ) : (
          <>
            <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Redirecting...</p>
          </>
        )}
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