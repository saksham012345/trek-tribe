import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

interface LoaderProps {
    fullScreen?: boolean;
    message?: string;
    color?: string;
}

const Loader: React.FC<LoaderProps> = ({
    fullScreen = false,
    message = 'Loading...',
    color = '#047857' // forest-700
}) => {
    return (
        <View style={[styles.container, fullScreen && styles.fullScreen]}>
            <ActivityIndicator size="large" color={color} />
            {message && <Text style={styles.text}>{message}</Text>}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    fullScreen: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        zIndex: 1000,
    },
    text: {
        marginTop: 10,
        fontSize: 16,
        color: '#065f46',
        fontWeight: '500',
    },
});

export default Loader;
