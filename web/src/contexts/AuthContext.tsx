import React, { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import api from '../config/api';
import { User } from '../types';

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
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(() => {
    // Try to restore user from localStorage on initial load
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to restore user from localStorage first (for faster UI)
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch (e) {
        // Invalid data, clear it
        localStorage.removeItem('user');
      }
    }

    // Always verify session with backend (cookie-based auth)
    // This is critical for session persistence
    api.get('/auth/me', {
      // Ensure credentials are sent with the request
      withCredentials: true
    })
      .then(response => {
        // Handle both { user: User } and direct User object formats
        const userData = response.data?.user || response.data;
        if (userData && (userData._id || userData.id)) {
          // User is authenticated - update state and localStorage
          setUser(userData as User);
          localStorage.setItem('user', JSON.stringify(userData));
          console.log('Session verified successfully');
        } else {
          // No user data in response - clear local storage
          console.log('No user data in response, clearing session');
          localStorage.removeItem('user');
          setUser(null);
        }
      })
      .catch((error) => {
        // 401 is expected when user is not logged in - don't clear user immediately
        // Only clear if we get a definitive 401 after initial load
        if (error?.response?.status === 401) {
          // Check if we had a user in localStorage - if yes, it might be a session expiry
          // If no, user was never logged in
          if (savedUser) {
            console.log('Session expired or invalid - clearing local user data');
            localStorage.removeItem('user');
            setUser(null);
          } else {
            // No saved user, so user was never logged in - this is normal
            setUser(null);
          }
        } else {
          // Network or server errors - keep user from localStorage for now
          // User can still use the app if localStorage has valid user data
          // Protected routes will verify again
          console.warn('Failed to verify session (non-401):', error?.response?.status || error?.message);
          // Don't clear user on network errors - might be temporary
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (emailOrCredential: string, passwordOrProvider?: string): Promise<{ success: boolean; error?: string }> => {
    try {
      let response;

      if (passwordOrProvider === 'google') {
        // Google OAuth login
        response = await api.post('/auth/google', {
          credential: emailOrCredential
        });
      } else {
        // Traditional email/password login
        response = await api.post('/auth/login', {
          email: emailOrCredential,
          password: passwordOrProvider
        });
      }

      const responseData = response.data as { token?: string; user: User };
      const userData = responseData.user;
      
      // Token is now in httpOnly cookie, no need to store it
      // Only store user data (non-sensitive) for faster UI loading
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Login failed';
      console.error('Login error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const setSession = async (token: string, userData?: User) => {
    // Token is now in httpOnly cookie (set by backend), no need to store it
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
      return;
    }

    try {
      const resp = await api.get('/auth/me');
      // Handle both { user: User } and direct User object formats
      const fetchedUser = resp.data?.user || resp.data;
      if (fetchedUser && fetchedUser._id) {
        setUser(fetchedUser as User);
        localStorage.setItem('user', JSON.stringify(fetchedUser));
      }
    } catch (e) {
      console.warn('setSession: failed to fetch user', e);
    }
  };

  const refreshUser = async () => {
    try {
      const resp = await api.get('/auth/me');
      const userData = resp.data?.user || resp.data;
      if (userData && userData._id) {
        setUser(userData as User);
        localStorage.setItem('user', JSON.stringify(userData));
      }
    } catch (e) {
      console.warn('refreshUser: failed to refresh user', e);
    }
  };

  const logout = async () => {
    try {
      // Call backend logout endpoint to clear httpOnly cookie
      await api.post('/auth/logout');
    } catch (error) {
      console.warn('Logout API call failed, clearing local data anyway:', error);
    }
    // Clear local user data
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