/**
 * Configuration utilities for Trek Tribe web application
 */

/**
 * Get the base website URL for shareable links
 * Falls back to current origin if not configured
 */
export const getWebsiteUrl = (): string => {
  // First check environment variable for production domain
  const configuredUrl = process.env.REACT_APP_WEBSITE_URL;
  
  if (configuredUrl && configuredUrl !== 'https://yourdomain.com') {
    return configuredUrl.endsWith('/') ? configuredUrl.slice(0, -1) : configuredUrl;
  }
  
  // Fallback to current origin for development
  if (typeof window !== 'undefined') {
    return window.location.origin;
  }
  
  return 'https://yourdomain.com';
};

/**
 * Generate a shareable trip URL
 * @param tripId - The trip ID
 * @returns Full shareable URL for the trip
 */
export const getTripShareUrl = (tripId: string): string => {
  return `${getWebsiteUrl()}/trip/${tripId}`;
};

/**
 * Generate a shareable user profile URL
 * @param userId - The user ID
 * @returns Full shareable URL for the user profile
 */
export const getUserProfileShareUrl = (userId: string): string => {
  return `${getWebsiteUrl()}/profile/${userId}`;
};

/**
 * Check if we're in development mode
 */
export const isDevelopment = (): boolean => {
  return process.env.NODE_ENV === 'development';
};

/**
 * Get the API base URL
 */
export const getApiUrl = (): string => {
  return process.env.REACT_APP_API_URL || 'http://localhost:4000';
};