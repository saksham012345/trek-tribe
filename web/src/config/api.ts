import axios from 'axios';
import { apiCache } from '../utils/apiCache';

// API Configuration
// Priority: explicit env → localhost fallback for development
let API_BASE_URL = process.env.REACT_APP_API_URL || '';

// Development fallback (only for local development)
if (!API_BASE_URL && process.env.NODE_ENV !== 'production') {
  API_BASE_URL = 'http://localhost:5000';
}

// Create axios instance with default configuration
const api: any = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // 30 seconds
  withCredentials: true, // CRITICAL: Required to send httpOnly cookies with cross-origin requests
  headers: {
    'Content-Type': 'application/json',
  },
  // Ensure credentials are always sent
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

// Request interceptor
api.interceptors.request.use(
  (config: any) => {
    // Check cache for GET requests (excluding sensitive endpoints)
    if (config.method === 'get' && !config.url?.includes('/auth') && !config.url?.includes('/payment')) {
      const cachedData = apiCache.get(config.url || '', config.params);
      if (cachedData) {
        // Return cached data wrapped in a resolved promise
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
      const isAuthEndpoint = error.config?.url?.includes('/auth/');

      if (isAuthEndpoint && error.config?.url?.includes('/auth/me')) {
        // Expected 401 on /auth/me when not logged in - silent
      } else if (!isAuthEndpoint && !error.config?._skipLogout) {
        console.warn('401 Unauthorized on:', error.config?.url);
      }
    }

    // Pass errors through - do NOT redirect here to avoid circular deps with Router/Context
    return Promise.reject(error);
  }
);

export default api;
export { API_BASE_URL };
