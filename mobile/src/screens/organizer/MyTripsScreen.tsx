import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Image,
    RefreshControl
} from 'react-native';
import { Calendar, Users, Edit3, Trash2, ChevronRight, MapPin } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';

const MyTripsScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchMyTrips();
    }, []);

    const fetchMyTrips = async () => {
        try {
            const response = await apiClient.get('/trips/organizer/my-trips');
            setTrips(response.data.trips || []);
        } catch (error) {
            console.error('Failed to fetch my trips:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const renderTrip = ({ item }: any) => (
        <View style={styles.tripCard}>
            <Image source={{ uri: item.coverImage }} style={styles.tripImage} />
            <View style={styles.tripContent}>
                <View style={styles.tripHeader}>
                    <Text style={styles.tripTitle} numberOfLines={1}>{item.title}</Text>
                    <TouchableOpacity style={styles.editBtn}>
                        <Edit3 size={18} color="#4f46e5" />
                    </TouchableOpacity>
                </View>

                <View style={styles.metaRow}>
                    <View style={styles.metaItem}>
                        <Calendar size={14} color="#64748b" />
                        <Text style={styles.metaText}>{new Date(item.startDate).toLocaleDateString()}</Text>
                    </View>
                    <View style={styles.metaItem}>
                        <Users size={14} color="#64748b" />
                        <Text style={styles.metaText}>{item.participantsCount || 0} Joined</Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <View style={styles.location}>
                        <MapPin size={14} color="#64748b" />
                        <Text style={styles.locationText}>{item.destination}</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.manageBtn}
                        onPress={() => navigation.navigate('TripDetails', { id: item._id })}
                    >
                        <Text style={styles.manageBtnText}>Manage</Text>
                        <ChevronRight size={16} color="#fff" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <FlatList
                data={trips}
                keyExtractor={(item: any) => item._id}
                renderItem={renderTrip}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={fetchMyTrips} />
                }
                ListEmptyComponent={!loading ? (
                    <EmptyState
                        title="No Trips Created"
                        message="Start by creating your first adventure for travelers!"
                        onAction={() => navigation.navigate('CreateTrip')}
                        actionText="Create Trip"
                    />
                ) : null}
                ListFooterComponent={loading ? <Loader /> : null}
                contentContainerStyle={styles.listContent}
            />

            {/* Floating Action Button */}
            <TouchableOpacity
                style={styles.fab}
                onPress={() => navigation.navigate('CreateTrip')}
            >
                <Edit3 size={24} color="#fff" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    listContent: {
        padding: 16,
        paddingBottom: 100,
    },
    tripCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    tripImage: {
        width: '100%',
        height: 120,
        backgroundColor: '#f3f4f6',
    },
    tripContent: {
        padding: 16,
    },
    tripHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    tripTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginRight: 12,
    },
    editBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    metaRow: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 16,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    metaText: {
        fontSize: 13,
        color: '#64748b',
        fontWeight: '500',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
    },
    location: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    locationText: {
        fontSize: 13,
        color: '#64748b',
    },
    manageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4f46e5',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 10,
        gap: 4,
    },
    manageBtnText: {
        color: '#fff',
        fontSize: 13,
        fontWeight: '700',
    },
    fab: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#4f46e5',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
    },
});

export default MyTripsScreen;
