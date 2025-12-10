import api from '../config/api';

/**
 * API Client Service
 * Provides a centralized interface for making API calls
 * Re-exports the configured axios instance from config/api.ts
 */

export const apiClient = api;

export default apiClient;
