import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MicrosoftService } from '../services/microsoftService';

export function AuthCallback() {
  const navigate = useNavigate();
  
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
        alert(`Authentication failed: ${error}\n${errorDescription || ''}`);
        navigate('/');
        return;
      }

      if (accessToken) {
        try {
          console.log('Processing access token...');
          await MicrosoftService.handleImplicitCallback(accessToken, urlParams);
          console.log('Authentication successful!');
          alert('Successfully connected to Microsoft OneDrive!');
          navigate('/');
        } catch (error) {
          console.error('Token processing failed:', error);
          alert(`Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
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
    </div>
  );
}