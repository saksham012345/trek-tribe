/**
 * Utility functions for URL handling and safety
 */

/**
 * Safely sanitizes a URL, returning undefined if it matches known invalid patterns.
 * Specifically guards against "data:;base64,=" which causes net::ERR_INVALID_URL crashes in Chrome.
 * 
 * @param url The URL to check
 * @returns The original URL if safe, or undefined if invalid
 */
export const getSafeUrl = (url: string | undefined | null): string | undefined => {
    if (!url) return undefined;

    // Guard against specific invalid base64 pattern seen in crash logs
    if (url === 'data:;base64,=' || url === 'data:;base64,') {
        return undefined;
    }

    // Basic validation that it's a string
    if (typeof url !== 'string') {
        return undefined;
    }

    return url;
};

/**
 * Checks if a URL is a valid http/https URL or a valid data URI
 */
export const isValidUrl = (url: string): boolean => {
    if (!url) return false;

    if (url.startsWith('data:')) {
        // Basic data URI validation - must have some content type and data
        return url.length > 15 && !url.includes('data:;base64,=' as any);
    }

    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/');
};
