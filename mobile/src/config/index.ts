import Constants from 'expo-constants';

/**
 * Mobile Configuration
 * Handles API URLs, Sockets, and Feature Flags
 */
export const CONFIG = {
    // Use local computer IP for development with physical devices
    API_URL: Constants.expoConfig?.extra?.apiUrl || 'https://trek-tribe-1-56gm.onrender.com',
    SOCKET_URL: Constants.expoConfig?.extra?.socketUrl || 'https://trek-tribe-1-56gm.onrender.com',
    FIREBASE: {
        STORAGE_BUCKET: 'trekktribe-7e1e6.appspot.com',
    },
    AUTH: {
        SECURE_STORE_TOKEN_KEY: 'auth_token',
        SECURE_STORE_USER_KEY: 'user_data',
    },
    FEATURE_FLAGS: {
        ENABLE_PUSH: true,
        ENABLE_AI_WIDGET: true,
        OFFLINE_SUPPORT: true,
    },
};

export default CONFIG;
