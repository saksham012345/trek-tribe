import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import CONFIG from '../config';

interface User {
    id: string;
    name: string;
    email: string;
    role: 'traveler' | 'organizer' | 'admin';
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    isLoading: boolean;
    login: (token: string, user: User) => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadCredentials();
    }, []);

    const loadCredentials = async () => {
        try {
            const storedToken = await SecureStore.getItemAsync(CONFIG.AUTH.SECURE_STORE_TOKEN_KEY);
            const storedUser = await SecureStore.getItemAsync(CONFIG.AUTH.SECURE_STORE_USER_KEY);

            if (storedToken && storedUser) {
                setToken(storedToken);
                setUser(JSON.parse(storedUser));
            }
        } catch (e) {
            console.error('Failed to load credentials', e);
        } finally {
            setIsLoading(false);
        }
    };

    const login = async (newToken: string, newUser: User) => {
        try {
            await SecureStore.setItemAsync(CONFIG.AUTH.SECURE_STORE_TOKEN_KEY, newToken);
            await SecureStore.setItemAsync(CONFIG.AUTH.SECURE_STORE_USER_KEY, JSON.stringify(newUser));
            setToken(newToken);
            setUser(newUser);
        } catch (e) {
            console.error('Failed to save credentials', e);
        }
    };

    const logout = async () => {
        try {
            await SecureStore.deleteItemAsync(CONFIG.AUTH.SECURE_STORE_TOKEN_KEY);
            await SecureStore.deleteItemAsync(CONFIG.AUTH.SECURE_STORE_USER_KEY);
            setToken(null);
            setUser(null);
        } catch (e) {
            console.error('Failed to clear credentials', e);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
