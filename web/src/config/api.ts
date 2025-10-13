import axios from 'axios';
import { apiCache } from '../utils/apiCache';

// API Configuration
// Priority: Environment Variable > Production Detection > Development Default
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? (window.location.hostname.includes('trektribe.in') || window.location.hostname.includes('onrender.com')
        ? 'https://trek-tribe-38in.onrender.com'  // Production API (for trektribe.in and Render)
        : 'https://trek-tribe-38in.onrender.com')  // Default to production API
    : 'https://trek-tribe-38in.onrender.com');  // Use Render backend for development too

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased to 30 seconds for Render's slower response times
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth tokens and check cache
api.interceptors.request.use(
  (config) => {
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
      // Only redirect to login for authentication endpoints or if no token exists
      const isAuthEndpoint = error.config?.url?.includes('/auth/') || error.config?.url?.includes('/login');
      const hasToken = localStorage.getItem('token'); // Fixed to match AuthContext
      
      if (!hasToken || isAuthEndpoint) {
        // Clear invalid token and redirect
        localStorage.removeItem('token'); // Fixed to match AuthContext
        window.location.href = '/login';
      } else {
        // For other 401 errors, just log and let the component handle it
        console.warn('API 401 Error:', error.config?.url, error.response?.data);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
