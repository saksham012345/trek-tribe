/**
 * Razorpay Utility Functions
 * Provides consistent Razorpay SDK loading and initialization
 */

declare global {
  interface Window {
    Razorpay: any;
  }
}

let razorpayLoaded = false;
let razorpayLoading = false;
let razorpayLoadPromise: Promise<boolean> | null = null;

/**
 * Load Razorpay checkout script
 * Returns a promise that resolves when Razorpay is ready
 */
export const loadRazorpay = (): Promise<boolean> => {
  // If already loaded, return immediately
  if (razorpayLoaded && window.Razorpay) {
    return Promise.resolve(true);
  }

  // If currently loading, return the existing promise
  if (razorpayLoading && razorpayLoadPromise) {
    return razorpayLoadPromise;
  }

  // Start loading
  razorpayLoading = true;
  razorpayLoadPromise = new Promise((resolve, reject) => {
    // Check if already in DOM
    const existingScript = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      // Script exists, wait for it to load
      const checkInterval = setInterval(() => {
        if (window.Razorpay) {
          clearInterval(checkInterval);
          razorpayLoaded = true;
          razorpayLoading = false;
          resolve(true);
        }
      }, 100);

      // Timeout after 10 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        if (!window.Razorpay) {
          razorpayLoading = false;
          razorpayLoadPromise = null;
          reject(new Error('Razorpay script timeout'));
        }
      }, 10000);
      return;
    }

    // Create and append script
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    
    script.onload = () => {
      if (window.Razorpay) {
        razorpayLoaded = true;
        razorpayLoading = false;
        console.log('✅ Razorpay SDK loaded successfully');
        resolve(true);
      } else {
        razorpayLoading = false;
        razorpayLoadPromise = null;
        reject(new Error('Razorpay SDK not available after script load'));
      }
    };
    
    script.onerror = () => {
      razorpayLoading = false;
      razorpayLoadPromise = null;
      console.error('❌ Failed to load Razorpay SDK');
      reject(new Error('Failed to load Razorpay checkout script'));
    };
    
    document.body.appendChild(script);
  });

  return razorpayLoadPromise;
};

/**
 * Check if Razorpay is available
 */
export const isRazorpayAvailable = (): boolean => {
  return razorpayLoaded && typeof window.Razorpay !== 'undefined';
};

/**
 * Get Razorpay instance (ensures SDK is loaded first)
 */
export const getRazorpayInstance = async (options: any) => {
  await loadRazorpay();
  
  if (!window.Razorpay) {
    throw new Error('Razorpay SDK is not available. Please refresh the page and try again.');
  }

  return new window.Razorpay(options);
};

/**
 * Preload Razorpay script (call on app initialization)
 */
export const preloadRazorpay = () => {
  if (typeof window !== 'undefined' && !razorpayLoaded && !razorpayLoading) {
    loadRazorpay().catch((error) => {
      console.warn('Failed to preload Razorpay:', error);
    });
  }
};

