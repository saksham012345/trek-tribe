import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import CONFIG from '../config';

/**
 * Centrailized Axios client with mobile interceptors
 */
const apiClient = axios.create({
    baseURL: CONFIG.API_URL,
    timeout: 15000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request Interceptor: Attach Auth Token
apiClient.interceptors.request.use(
    async (config) => {
        const token = await SecureStore.getItemAsync(CONFIG.AUTH.SECURE_STORE_TOKEN_KEY);
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Auto-Logout
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            // Clear credentials on 401
            await SecureStore.deleteItemAsync(CONFIG.AUTH.SECURE_STORE_TOKEN_KEY);
            await SecureStore.deleteItemAsync(CONFIG.AUTH.SECURE_STORE_USER_KEY);

            // Note: Navigation logout is handled via AuthContext listener
            return Promise.reject(error);
        }

        return Promise.reject(error);
    }
);

export default apiClient;
