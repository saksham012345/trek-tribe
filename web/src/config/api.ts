import axios from 'axios';

// API Configuration
// Priority: Environment Variable > Production Detection > Development Default
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? (window.location.hostname.includes('onrender.com') 
        ? 'https://trek-tribe-38in.onrender.com'  // Render deployment - corrected URL
        : 'https://your-api-domain.vercel.app')  // Vercel deployment
    : 'http://localhost:4000');  // Local development

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000, // Increased to 30 seconds for Render's slower response times
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth tokens
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Only redirect to login for authentication endpoints or if no token exists
      const isAuthEndpoint = error.config?.url?.includes('/auth/') || error.config?.url?.includes('/login');
      const hasToken = localStorage.getItem('authToken');
      
      if (!hasToken || isAuthEndpoint) {
        // Clear invalid token and redirect
        localStorage.removeItem('authToken');
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
