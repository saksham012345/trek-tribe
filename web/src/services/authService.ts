import api from '../config/api';
import { User } from '../types';

interface LoginResponse {
    token?: string;
    user: User;
}

interface LoginResult {
    success: boolean;
    error?: string;
}

/**
 * AuthService
 * Handles all authentication-related API calls.
 * Separated from AuthContext to prevent circular dependencies and improve maintainability.
 */
export const authService = {
    /**
     * Verify current session with the backend
     */
    verifySession: async (): Promise<User | null> => {
        try {
            const response = await api.get('/auth/me');

            // Handle both { user: User } and direct User object formats
            const userData = response.data?.user || response.data;

            if (userData && (userData._id || userData.id)) {
                return userData as User;
            }
            return null;
        } catch (error: any) {
            // Allow 401 (not logged in) to pass through as null
            if (error?.response?.status === 401) {
                return null;
            }
            // Re-throw other errors (network, timeout) to be handled by caller
            throw error;
        }
    },

    /**
     * Login with email and password or Google credential
     */
    login: async (emailOrCredential: string, passwordOrProvider?: string): Promise<LoginResult> => {
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

            const responseData = response.data as LoginResponse;
            const userData = responseData.user;

            // Store token locally as a fallback for admin/cross-origin requests (Hybrid Auth)
            if (responseData.token) {
                localStorage.setItem('token', responseData.token);
            }

            return { success: true };
        } catch (error: any) {
            const errorMessage = error.response?.data?.error || error.response?.data?.message || 'Login failed';
            console.error('Login error:', errorMessage);
            return { success: false, error: errorMessage };
        }
    },

    /**
     * Logout user
     */
    logout: async (): Promise<void> => {
        try {
            await api.post('/auth/logout');
        } catch (error) {
            console.warn('Logout API call failed:', error);
        }
    }
};

export default authService;
