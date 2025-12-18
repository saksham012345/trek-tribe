import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Verify token and get user info (api instance handles auth headers)
      api.get('/auth/me')
        .then(response => {
          // Handle both { user: User } and direct User object formats
          const userData = response.data?.user || response.data;
          if (userData && userData._id) {
            setUser(userData as User);
          } else {
            localStorage.removeItem('token');
          }
        })
        .catch((error) => {
          console.error('Failed to restore session:', error);
          localStorage.removeItem('token');
          setLoading(false);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
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

      const responseData = response.data as { token: string; user: User };
      const { token, user: userData } = responseData;
      
      localStorage.setItem('token', token);
      setUser(userData);
      
      return { success: true };
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Login failed';
      console.error('Login error:', errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  const setSession = async (token: string, userData?: User) => {
    localStorage.setItem('token', token);
    if (userData) {
      setUser(userData);
      return;
    }

    try {
      const resp = await api.get('/auth/me');
      // Handle both { user: User } and direct User object formats
      const user = resp.data?.user || resp.data;
      if (user && user._id) {
        setUser(user as User);
      }
    } catch (e) {
      // If fetching user fails, at least keep token in storage and let app handle next steps
      console.warn('setSession: failed to fetch user after setting token', e);
    }
  };

  const refreshUser = async () => {
    try {
      const resp = await api.get('/auth/me');
      if (resp.data?.user) setUser(resp.data.user as User);
    } catch (e) {
      console.warn('refreshUser: failed to refresh user');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...userData });
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
};