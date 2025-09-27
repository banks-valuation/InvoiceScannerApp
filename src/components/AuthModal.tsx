import React, { useState } from 'react';
import { User } from 'lucide-react';
import { MicrosoftService } from '../services/microsoftService';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onAuthSuccess }: AuthModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleMicrosoftLogin = async () => {
    setError('');
    setLoading(true);

    try {
      MicrosoftService.initiateLogin();
    } catch (error) {
      console.error('Microsoft login error:', error);
      setError(error instanceof Error ? error.message : 'Microsoft login failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center mx-auto mb-4">
              <User className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Welcome to Invoice Manager
            </h2>
            <p className="text-blue-100">
              Sign in with your Microsoft account to start managing your invoices
            </p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="text-center mb-6">
            <p className="text-gray-600 mb-4">
              Use your Microsoft 365 account to access all features including OneDrive sync and Excel tracking.
            </p>
          </div>

          <button
            onClick={handleMicrosoftLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zM24 11.4H12.6V0H24v11.4z"/>
                </svg>
                Sign in with Microsoft
              </>
            )}
          </button>

          <div className="text-center mt-4">
            <p className="text-xs text-gray-500">
              By signing in, you agree to sync your invoice data with Microsoft OneDrive and Excel for backup and tracking purposes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}