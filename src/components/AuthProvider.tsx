import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { AuthModal } from './AuthModal';
import { SettingsService } from '../services/settingsService';
import { MicrosoftService } from '../services/microsoftService';

interface AuthContextType {
  user: User | null;
  session: Session | null;
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [hasTriedAutoConnect, setHasTriedAutoConnect] = useState(false);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        // Show auth modal if no session
        if (!session) {
          setShowAuthModal(true);
        }
      })
      .catch((error) => {
        console.error('Failed to get initial session:', error);
        // Handle invalid session by setting logged-out state
        setSession(null);
        setUser(null);
        setLoading(false);
        setShowAuthModal(true);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      // Clear settings cache and reload when user signs in
      if (event === 'SIGNED_IN' && session?.user) {
        SettingsService.clearCache();
        try {
          // Preload settings from database to sync with other devices
          await SettingsService.getSettings(session.user);
        } catch (error) {
          console.error('Failed to reload settings after login:', error);
        }
        
        // Auto-connect to OneDrive after successful login (only once per session)
        if (!hasTriedAutoConnect) {
          setHasTriedAutoConnect(true);
          setTimeout(() => {
            // Check if already connected to avoid unnecessary redirects
            if (!MicrosoftService.isAuthenticated()) {
              console.log('Auto-connecting to OneDrive after login...');
              try {
                MicrosoftService.initiateLogin();
              } catch (error) {
                console.error('Auto OneDrive connection failed:', error);
                // Don't show error to user for auto-connect failure
              }
            }
          }, 1000); // Small delay to ensure UI is ready
        }
      }
      
      // Show/hide auth modal based on session
      setShowAuthModal(!session);
      
      // Reset auto-connect flag when user signs out
      if (event === 'SIGNED_OUT') {
        setHasTriedAutoConnect(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    // Clear settings cache when signing out
    SettingsService.clearCache();
    
    // Reset auto-connect flag
    setHasTriedAutoConnect(false);
    
    try {
      await supabase.auth.signOut();
    } catch (error: any) {
      // Handle case where session doesn't exist on server
      if (error?.message?.includes('Session from session_id claim in JWT does not exist')) {
        // Manually update local state to reflect logged-out state
        setSession(null);
        setUser(null);
        setShowAuthModal(true);
      } else {
        // Re-throw other errors
        throw error;
      }
    }
  };

  const value = {
    user,
    session,
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
      <AuthModal 
        isOpen={showAuthModal} 
        onClose={() => setShowAuthModal(false)} 
      />
    </AuthContext.Provider>
  );
}