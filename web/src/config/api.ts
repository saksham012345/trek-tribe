import axios from 'axios';

// API Configuration
// Priority: Environment Variable > Production Detection > Development Default
const API_BASE_URL = process.env.REACT_APP_API_URL || 
  (process.env.NODE_ENV === 'production' 
    ? 'https://trekktribe.onrender.com'  // Backend is always on Render
    : 'http://localhost:4000');  // Local development

// Create axios instance with default configuration
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth tokens
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
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
      // Handle unauthorized access
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Chat API endpoints
export const chatAPI = {
  // Chat session management
  startChat: (data: { category: string; priority: 'low' | 'medium' | 'high' | 'urgent'; initialMessage?: string }) => 
    api.post('/chat/start', data),
    
  getChatHistory: (page: number = 1, limit: number = 20) => 
    api.get(`/chat/history?page=${page}&limit=${limit}`),
    
  getChatDetails: (roomId: string) => 
    api.get(`/chat/${roomId}`),
    
  updateChatPriority: (roomId: string, priority: 'low' | 'medium' | 'high' | 'urgent') => 
    api.patch(`/chat/${roomId}/priority`, { priority }),
    
  closeChat: (roomId: string, data: { reason?: string; satisfaction?: number; feedback?: string }) => 
    api.post(`/chat/${roomId}/close`, data),
    
  // Agent-specific endpoints
  getUnassignedChats: () => 
    api.get('/chat/agent/unassigned'),
    
  getAssignedChats: () => 
    api.get('/chat/agent/assigned'),
    
  takeChat: (roomId: string) => 
    api.post(`/chat/${roomId}/take`),
    
  transferChat: (roomId: string, data: { targetAgentId?: string; reason: string }) => 
    api.post(`/chat/${roomId}/transfer`, data),
    
  // Analytics endpoints
  getChatAnalytics: (timeframe: 'today' | 'week' | 'month' | 'year' = 'today') => 
    api.get(`/chat/analytics/overview?timeframe=${timeframe}`),
    
  getAgentPerformance: (agentId?: string, timeframe: 'today' | 'week' | 'month' = 'week') => 
    api.get(`/chat/analytics/agent${agentId ? `/${agentId}` : ''}?timeframe=${timeframe}`)
};

// Utility functions
export const getAuthToken = (): string | null => {
  return localStorage.getItem('token');
};

export const getUserFromStorage = (): any | null => {
  const userStr = localStorage.getItem('user');
  return userStr ? JSON.parse(userStr) : null;
};

export const setAuthData = (token: string, user: any): void => {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
};

export const clearAuthData = (): void => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

export default api;
export { API_BASE_URL };
