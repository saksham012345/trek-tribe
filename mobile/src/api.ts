import axios from 'axios';

// Use env if provided, else the production API
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://trekktribe.onrender.com';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

api.interceptors.request.use((config) => {
  // Optional: token storage via Expo SecureStore or AsyncStorage
  return config;
});
