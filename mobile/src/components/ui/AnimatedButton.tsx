import React from 'react';
import { TouchableOpacity, Text, StyleSheet, TouchableOpacityProps, ViewStyle, TextStyle } from 'react-native';
import { COLORS, SHADOWS, RADIUS } from '../theme/DesignSystem';

interface AnimatedButtonProps extends TouchableOpacityProps {
    title: string;
    variant?: 'primary' | 'secondary' | 'outline';
    style?: ViewStyle;
    textStyle?: TextStyle;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
    title,
    variant = 'primary',
    style,
    textStyle,
    ...props
}) => {
    const getVariantStyle = () => {
        switch (variant) {
            case 'primary':
                return styles.primary;
            case 'secondary':
                return styles.secondary;
            case 'outline':
                return styles.outline;
            default:
                return styles.primary;
        }
    };

    const getTextColor = () => {
        switch (variant) {
            case 'primary':
            case 'secondary':
                return '#fff';
            case 'outline':
                return COLORS.primary;
            default:
                return '#fff';
        }
    };

    return (
        <TouchableOpacity
            activeOpacity={0.8}
            style={[styles.base, getVariantStyle(), style]}
            {...props}
        >
            <Text style={[styles.text, { color: getTextColor() }, textStyle]}>
                {title}
            </Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    base: {
        paddingVertical: 14,
        paddingHorizontal: 24,
        borderRadius: RADIUS.lg,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.sm,
    },
    primary: {
        backgroundColor: COLORS.primary,
        ...SHADOWS.colored,
    },
    secondary: {
        backgroundColor: COLORS.secondary,
    },
    outline: {
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderColor: COLORS.primary,
    },
    text: {
        fontSize: 16,
        fontWeight: 'bold',
    }
});

export default AnimatedButton;
