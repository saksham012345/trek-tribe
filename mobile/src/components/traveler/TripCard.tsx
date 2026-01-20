import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Calendar, Users } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

interface Trip {
    _id: string;
    title: string;
    destination: string;
    price: number;
    startDate: string;
    difficultyLevel: 'beginner' | 'intermediate' | 'advanced';
    coverImage: string;
    categories: string[];
}

const TripCard: React.FC<{ trip: Trip }> = ({ trip }) => {
    const navigation = useNavigation<any>();

    const getDifficultyStyles = (level: string) => {
        switch (level) {
            case 'beginner': return { color: '#059669', bg: '#f0fdf4', label: '🟢 Beginner' };
            case 'intermediate': return { color: '#d97706', bg: '#fffbeb', label: '🟡 Intermediate' };
            case 'advanced': return { color: '#dc2626', bg: '#fef2f2', label: '🔴 Advanced' };
            default: return { color: '#4b5563', bg: '#f3f4f6', label: '⚪ Unknown' };
        }
    };

    const difficulty = getDifficultyStyles(trip.difficultyLevel);

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('TripDetails', { id: trip._id })}
            activeOpacity={0.9}
        >
            <Image
                source={{ uri: trip.coverImage || 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b' }}
                style={styles.image}
            />
            <View style={styles.overlay}>
                <View style={[styles.badge, { backgroundColor: difficulty.bg }]}>
                    <Text style={[styles.badgeText, { color: difficulty.color }]}>{difficulty.label}</Text>
                </View>
            </View>

            <View style={styles.content}>
                <Text style={styles.title} numberOfLines={1}>{trip.title}</Text>

                <View style={styles.infoRow}>
                    <MapPin size={14} color="#666" />
                    <Text style={styles.infoText}>{trip.destination}</Text>
                </View>

                <View style={styles.footer}>
                    <View style={styles.stats}>
                        <View style={styles.statItem}>
                            <Calendar size={14} color="#047857" />
                            <Text style={styles.statText}>
                                {new Date(trip.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.priceContainer}>
                        <Text style={styles.priceLabel}>from</Text>
                        <Text style={styles.priceText}>₹{trip.price.toLocaleString()}</Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        marginBottom: 20,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 3,
        marginHorizontal: 16,
    },
    image: {
        width: '100%',
        height: 200,
        backgroundColor: '#f3f4f6',
    },
    overlay: {
        position: 'absolute',
        top: 12,
        right: 12,
    },
    badge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    badgeText: {
        fontSize: 12,
        fontWeight: '700',
    },
    content: {
        padding: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#111827',
        marginBottom: 8,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoText: {
        fontSize: 14,
        color: '#6b7280',
        marginLeft: 4,
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: '#f3f4f6',
        paddingTop: 12,
    },
    stats: {
        flexDirection: 'row',
        gap: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 13,
        color: '#374151',
        fontWeight: '500',
    },
    priceContainer: {
        alignItems: 'flex-end',
    },
    priceLabel: {
        fontSize: 10,
        color: '#6b7280',
        textTransform: 'uppercase',
    },
    priceText: {
        fontSize: 20,
        fontWeight: '800',
        color: '#047857',
    },
});

export default TripCard;
