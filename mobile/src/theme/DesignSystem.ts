import { StyleSheet } from 'react-native';

export const COLORS = {
    primary: '#0F766E', // Deep Teal
    primaryDark: '#0D5D56',
    primaryLight: '#14B8A6',
    secondary: '#059669', // Emerald
    accent: '#F59E0B',    // Amber
    mountain: '#1E40AF',  // Royal Blue

    background: '#F9FAFB',
    card: '#FFFFFF',
    text: '#111827',
    textLight: '#6B7280',
    textLighter: '#9CA3AF',
    border: '#E5E7EB',

    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6',

    glass: 'rgba(255, 255, 255, 0.7)',
    glassDark: 'rgba(15, 118, 110, 0.1)',
};

export const GRADIENTS = {
    primary: ['#0F766E', '#0D5D56', '#059669'],
    nature: ['#059669', '#10B981', '#34D399'],
    sunset: ['#F59E0B', '#F43F5E', '#881337'],
};

export const SHADOWS = {
    sm: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1,
    },
    md: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    lg: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
    },
    colored: {
        shadowColor: COLORS.primary,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
        elevation: 8,
    }
};

export const RADIUS = {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    full: 999,
};

export const SPACING = {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
};
