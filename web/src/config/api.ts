import axios from 'axios';
import { apiCache } from '../utils/apiCache';

// API Configuration
// Priority: explicit env → hosted API (Render/Vercel)
let API_BASE_URL = process.env.REACT_APP_API_URL || '';

// Robust fallback to the working Render API host
if (!API_BASE_URL) {
  API_BASE_URL = 'https://trek-tribe-38in.onrender.com';
}

// Create axios instance with default configuration
const api: any = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased to 30 seconds for Render's slower response times
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth tokens and check cache
api.interceptors.request.use(
  (config: any) => {
    const token = localStorage.getItem('token'); // Fixed to match AuthContext
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Check cache for GET requests (excluding sensitive endpoints)
    if (config.method === 'get' && !config.url?.includes('/auth') && !config.url?.includes('/payment')) {
      const cachedData = apiCache.get(config.url || '', config.params);
      if (cachedData) {
        // Return cached data wrapped in a resolved promise to match axios response structure
        return Promise.reject({ 
          __cached: true, 
          data: cachedData,
          status: 200,
          statusText: 'OK',
          headers: {},
          config
        });
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and caching
api.interceptors.response.use(
  (response) => {
    // Cache successful GET responses (excluding sensitive endpoints)
    if (response.config.method === 'get' && 
        !response.config.url?.includes('/auth') && 
        !response.config.url?.includes('/payment') &&
        response.status === 200) {
      
      // Different TTL for different endpoints
      let ttl = 5 * 60 * 1000; // 5 minutes default
      
      if (response.config.url?.includes('/trips')) {
        ttl = 10 * 60 * 1000; // 10 minutes for trips
      } else if (response.config.url?.includes('/ai')) {
        ttl = 30 * 60 * 1000; // 30 minutes for AI recommendations
      }
      
      apiCache.set(response.config.url || '', response.data, response.config.params, ttl);
    }
    
    return response;
  },
  (error) => {
    // Handle cached responses
    if (error.__cached) {
      return Promise.resolve(error);
    }
    
    if (error.response?.status === 401) {
      // Do not redirect for auth endpoints (e.g., /auth/login). Let the UI handle the error message.
      const isAuthEndpoint = error.config?.url?.includes('/auth/');

      if (!isAuthEndpoint) {
        const hasToken = Boolean(localStorage.getItem('token'));
        if (hasToken) {
          // Token is invalid/expired: clear and redirect to login
          localStorage.removeItem('token');
          window.location.href = '/login';
        }
        // If there's no token, just reject so the caller can handle it
      } else {
        // For auth endpoints, avoid redirecting to prevent clearing UI error states
        console.warn('Auth 401 (no redirect):', error.config?.url, error.response?.data);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
