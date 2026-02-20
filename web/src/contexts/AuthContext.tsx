import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../services/authService';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (emailOrCredential: string, passwordOrProvider?: string) => Promise<{ success: boolean; error?: string }>;
  setSession: (token: string, userData?: User) => Promise<void>;
  refreshUser?: () => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children?: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  // Initialize state immediately from localStorage to prevent flicker
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      console.error('Failed to parse user from localStorage', e);
      return null;
    }
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Session verification logic
    const verifySession = async () => {
      try {
        const verifiedUser = await authService.verifySession();

        if (verifiedUser) {
          // Session valid
          setUser(verifiedUser);
          localStorage.setItem('user', JSON.stringify(verifiedUser));
          console.log('✅ Session verified successfully');
        } else {
          // Session invalid/expired (401)
          const localUser = localStorage.getItem('user');
          if (localUser) {
            console.log('⚠️ Session invalid but user found in storage - clearing.');
            localStorage.removeItem('user');
            setUser(null);
          }
        }
      } catch (error: any) {
        // Network error / Timeout
        console.warn('⚠️ Session verification failed (network/timeout):', error.message);

        // Strategy: TRUST LOCAL STORAGE on network failures (Offline support / Resilience)
        // If we have a user in memory/storage, keep them logged in until explicit 401
        const savedUser = localStorage.getItem('user');
        if (savedUser && !user) {
          try {
            setUser(JSON.parse(savedUser));
            console.log('ℹ️  Restored user from localStorage fallback');
          } catch (e) {
            localStorage.removeItem('user');
          }
        }
      } finally {
        setLoading(false);
      }
    };

    verifySession();
  }, []); // Run once on mount

  const login = async (emailOrCredential: string, passwordOrProvider?: string): Promise<{ success: boolean; error?: string }> => {
    const result = await authService.login(emailOrCredential, passwordOrProvider);

    if (result.success) {
      // Refresh user data from server (or response could have returned it, but let's verify)
      try {
        const verifiedUser = await authService.verifySession();
        if (verifiedUser) {
          setUser(verifiedUser);
          localStorage.setItem('user', JSON.stringify(verifiedUser));
        }
      } catch (e) {
        // Fallback if verify fails immediately after login (rare)
        console.warn('Login successful but immediate session check failed');
      }
    }

    return result;
  };

  const setSession = async (token: string, userData?: User) => {
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return;
    }

    // Refresh from server
    try {
      const fetchedUser = await authService.verifySession();
      if (fetchedUser) {
        setUser(fetchedUser);
        localStorage.setItem('user', JSON.stringify(fetchedUser));
      }
    } catch (e) {
      console.warn('setSession: failed to fetch user', e);
    }
  };

  const refreshUser = async () => {
    try {
      const userData = await authService.verifySession();
      if (userData) {
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (e) {
      console.warn('refreshUser: failed to refresh user', e);
    }
  };

  const logout = async () => {
    await authService.logout();
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updated = { ...user, ...userData } as User;
      setUser(updated);
      localStorage.setItem('user', JSON.stringify(updated));
    }
  };

  const value = {
    user,
    loading,
    login,
    setSession,
    refreshUser,
    logout,
    updateUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}