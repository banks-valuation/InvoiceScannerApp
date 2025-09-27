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
      
      // Check for authorization code or error
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error');
      const errorDescription = urlParams.get('error_description');
      const state = urlParams.get('state');

      console.log('URL params:', { 
        code: code ? 'present' : 'missing', 
        state: state ? 'present' : 'missing',
        error,
        errorDescription 
      });
      
      if (error) {
        console.error('Authentication error:', error, errorDescription);
        alertModal.showAlert({
          title: 'Authentication Failed',
          message: `Authentication failed: ${error}\n\n${errorDescription || 'Please try signing in again.'}`,
          type: 'error'
        });
        setTimeout(() => navigate('/'), 3000);
        return;
      }

      if (code) {
        // Authorization code flow with PKCE
        try {
          console.log('Processing authorization code with PKCE...');
          
          // Add a small delay to ensure all storage operations are complete
          await new Promise(resolve => setTimeout(resolve, 100));
          
          await MicrosoftService.handleAuthorizationCallback(code);
          console.log('Authentication successful!');
          
          // Fetch user profile to complete authentication
          await MicrosoftService.fetchUserProfile();
          console.log('User profile fetched successfully');
          
          alertModal.showAlert({
            title: 'Welcome!',
            message: 'Successfully signed in with Microsoft!',
            type: 'success'
          });
          
          // Navigate after a short delay to show the success message
          setTimeout(() => navigate('/'), 1500);
        } catch (error) {
          console.error('Authorization code processing failed:', error);
          
          // Clear any stored auth data on failure
          localStorage.removeItem('ms_code_verifier');
          localStorage.removeItem('pkce_code_verifier');
          localStorage.removeItem('ms_auth_state');
          sessionStorage.removeItem('ms_code_verifier');
          sessionStorage.removeItem('ms_auth_state');
          
          alertModal.showAlert({
            title: 'Sign In Failed',
            message: `${error instanceof Error ? error.message : 'Unknown error'}. Please try signing in again.`,
            type: 'error'
          });
          setTimeout(() => navigate('/'), 3000);
        }
      } else {
        console.log('No authorization code found, redirecting to home');
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate, alertModal]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">Signing you in...</p>
        <p className="text-sm text-gray-500 mt-2">Please wait while we complete the authentication</p>
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