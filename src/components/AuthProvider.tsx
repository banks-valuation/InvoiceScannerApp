import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { User } from '@supabase/supabase-js';
import { AuthModal } from './AuthModal';
import { SettingsService } from '../services/settingsService';

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
    // Get initial session
    const getInitialSession = async () => {
      console.log('AuthProvider: Getting initial session...');
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Error getting session:', error);
      }
      
      if (session?.user) {
        console.log('AuthProvider: Found existing session for user:', session.user.email);
        setUser(session.user);
        setShowAuthModal(false);
      } else {
        console.log('AuthProvider: No existing session found');
        setUser(null);
        setShowAuthModal(true);
      }
      
      setLoading(false);
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthProvider: Auth state changed:', event, session?.user?.email);
        
        if (session?.user) {
          setUser(session.user);
          setShowAuthModal(false);
          
          // Clear settings cache and reload when user signs in
          SettingsService.clearCache();
          try {
            // Preload settings from database
            await SettingsService.getSettings(session.user);
          } catch (error) {
            console.error('Failed to reload settings after login:', error);
          }
        } else {
          setUser(null);
          setShowAuthModal(true);
          // Clear settings cache when signing out
          SettingsService.clearCache();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    console.log('AuthProvider: Signing out...');
    
    // Clear settings cache when signing out
    SettingsService.clearCache();
    
    // Sign out from Supabase
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
    
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