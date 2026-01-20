import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ghost, RefreshCcw } from 'lucide-react-native';

interface EmptyStateProps {
    title?: string;
    message?: string;
    onAction?: () => void;
    actionText?: string;
    icon?: React.ReactNode;
}

const EmptyState: React.FC<EmptyStateProps> = ({
    title = 'No Results Found',
    message = "We couldn't find any trips matching your criteria.",
    onAction,
    actionText = 'Refresh',
    icon
}) => {
    return (
        <View style={styles.container}>
            {icon ? icon : <Ghost size={64} color="#9ca3af" />}
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>

            {onAction && (
                <TouchableOpacity style={styles.button} onPress={onAction}>
                    <RefreshCcw size={18} color="#fff" />
                    <Text style={styles.buttonText}>{actionText}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#374151',
        marginTop: 16,
        marginBottom: 8,
    },
    message: {
        fontSize: 14,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 20,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#047857',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    buttonText: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 16,
    },
});

export default EmptyState;
