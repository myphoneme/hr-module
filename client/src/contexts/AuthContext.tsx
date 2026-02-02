import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../api/auth';
import type { User, AuthContextType } from '../types';

interface ExtendedAuthContextType extends AuthContextType {
  googleLogin: (credential: string) => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<ExtendedAuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    try {
      const response = await authApi.getCurrentUser();
      setUser(response.user);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // This listener handles the final step of the OAuth flow
  useEffect(() => {
    const handleOAuthCallback = async (event: MessageEvent) => {
      // Ensure the message is from a trusted source (our own popup)
      if (event.origin !== window.location.origin) {
        return;
      }

      const { type, code } = event.data || {};
      const isKnownType = type === 'gmail-oauth-callback' || type === 'calendar-oauth-callback';

      if (!code || !isKnownType) {
        return;
      }

      try {
        const endpoint = type === 'gmail-oauth-callback' ? '/gmail/callback' : '/calendar/callback';
        // The main window, which is authenticated, makes this call
        await authApi.post(endpoint, { code });
        // Reload the page to show the new "connected" status
        window.location.reload();
      } catch (error) {
        console.error('Failed to finalize OAuth connection:', error);
        alert('Failed to connect Google Account. Please try again.');
      }
    };

    window.addEventListener('message', handleOAuthCallback);
    return () => {
      window.removeEventListener('message', handleOAuthCallback);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    setUser(response.user);
    setIsLoading(false);
  };

  const googleLogin = async (credential: string) => {
    const response = await authApi.googleLogin(credential);
    setUser(response.user);
    setIsLoading(false);
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
  };

  const value: ExtendedAuthContextType = {
    user,
    isLoading,
    login,
    googleLogin,
    logout,
    checkAuth,
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}