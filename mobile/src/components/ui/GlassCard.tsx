import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { COLORS, SHADOWS, RADIUS } from '../theme/DesignSystem';

interface GlassCardProps extends ViewProps {
    intensity?: number;
    children: React.ReactNode;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, style, ...props }) => {
    return (
        <View style={[styles.card, style]} {...props}>
            <View style={styles.content}>
                {children}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.glass,
        borderRadius: RADIUS.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.4)',
        overflow: 'hidden',
        ...SHADOWS.md,
    },
    content: {
        padding: 16,
    }
});

export default GlassCard;
