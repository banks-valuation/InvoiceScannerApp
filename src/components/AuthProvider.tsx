import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthModal } from './AuthModal';
import { SettingsService } from '../services/settingsService';
import { MicrosoftService } from '../services/microsoftService';

interface User {
  id: string;
  displayName: string;
  email: string;
  userPrincipalName: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    // Check if user is already authenticated with Microsoft
    const checkAuth = async () => {
      console.log('AuthProvider: Checking authentication status...');
      
      if (MicrosoftService.isAuthenticated()) {
        console.log('AuthProvider: User is authenticated, fetching profile...');
        const profile = MicrosoftService.getCurrentUser();
        if (profile) {
          console.log('AuthProvider: Profile found in cache:', profile.displayName);
          setUser({
            id: profile.id,
            displayName: profile.displayName,
            email: profile.mail,
            userPrincipalName: profile.userPrincipalName,
          });
          setShowAuthModal(false);
        } else {
          // Try to fetch profile if authenticated but no profile cached
          try {
            console.log('AuthProvider: Fetching profile from Microsoft Graph...');
            const fetchedProfile = await MicrosoftService.fetchUserProfile();
            console.log('AuthProvider: Profile fetched successfully:', fetchedProfile.displayName);
            setUser({
              id: fetchedProfile.id,
              displayName: fetchedProfile.displayName,
              email: fetchedProfile.mail,
              userPrincipalName: fetchedProfile.userPrincipalName,
            });
            setShowAuthModal(false);
          } catch (error) {
            console.error('Failed to fetch user profile:', error);
            setUser(null);
            setShowAuthModal(true);
          }
        }
      } else {
        console.log('AuthProvider: User not authenticated, showing auth modal');
        setUser(null);
        setShowAuthModal(true);
      }
      
      setLoading(false);
    };

    checkAuth();
  }, []);

  // Listen for successful authentication from callback
  useEffect(() => {
    const handleAuthSuccess = async () => {
      console.log('AuthProvider: Received auth success event, checking status...');
      
      if (MicrosoftService.isAuthenticated()) {
        try {
          const profile = await MicrosoftService.fetchUserProfile();
          console.log('AuthProvider: Setting user profile:', profile.displayName);
          setUser({
            id: profile.id,
            displayName: profile.displayName,
            email: profile.mail,
            userPrincipalName: profile.userPrincipalName,
          });
          setShowAuthModal(false);
          
          // Clear settings cache and reload when user signs in
          SettingsService.clearCache();
          try {
            // Preload settings from database to sync with other devices
            await SettingsService.getSettings({ id: profile.id });
          } catch (error) {
            console.error('Failed to reload settings after login:', error);
          }
        } catch (error) {
          console.error('Failed to handle auth success:', error);
          setUser(null);
          setShowAuthModal(true);
        }
      }
    };

    // Only check for auth changes when not on callback page
    if (!window.location.pathname.includes('/auth/callback')) {
      // Listen for page visibility changes (when user returns from Microsoft auth)
      const handleVisibilityChange = () => {
        if (!document.hidden && !user && MicrosoftService.isAuthenticated()) {
          console.log('AuthProvider: Page became visible and user authenticated, updating state...');
          handleAuthSuccess();
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Also check periodically in case the callback didn't trigger properly
      const interval = setInterval(() => {
        if (!user && MicrosoftService.isAuthenticated()) {
          console.log('AuthProvider: Periodic check found authenticated user, updating state...');
          handleAuthSuccess();
        }
      }, 2000); // Reduced frequency
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        clearInterval(interval);
      };
    }
  }, [user]);

  const signOut = async () => {
    // Clear settings cache when signing out
    SettingsService.clearCache();
    
    // Clear Microsoft authentication
    MicrosoftService.logout();
    
    // Update local state
    setUser(null);
    setShowAuthModal(true);
  };

  const value = {
    user,
    loading,
    signOut,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showAuthModal && (
        <AuthModal 
          isOpen={showAuthModal} 
          onClose={() => setShowAuthModal(false)} 
        />
      )}
    </AuthContext.Provider>
  );
}