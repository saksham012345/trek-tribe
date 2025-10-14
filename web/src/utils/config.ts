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
  
  // In production, use the actual hostname for shareable links
  if (typeof window !== 'undefined') {
    // If on production domain, use it
    if (window.location.hostname.includes('trektribe.in')) {
      return 'https://www.trektribe.in';
    }
    return window.location.origin;
  }
  
  // Default fallback for production builds
  return 'https://www.trektribe.in';
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
  // Use environment variable if set
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // In production, use production API
  if (process.env.NODE_ENV === 'production') {
    return 'https://trek-tribe-38in.onrender.com';
  }
  
  // Development default - use production API for consistency
  return 'https://trek-tribe-38in.onrender.com';
};