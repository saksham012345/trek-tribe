import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Image
} from 'react-native';
import { Calendar, MapPin, ChevronRight, Clock } from 'lucide-react-native';
import apiClient from '../../api/client';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';

const TABS = ['Upcoming', 'Past', 'Cancelled'];

const MyBookingsScreen: React.FC = () => {
    const [activeTab, setActiveTab] = useState('Upcoming');
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchBookings();
    }, [activeTab]);

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/bookings/my-bookings', {
                params: { status: activeTab.toLowerCase() }
            });
            setBookings(response.data.bookings || []);
        } catch (error) {
            console.error('Failed to fetch bookings:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const renderBookingItem = ({ item }: any) => (
        <TouchableOpacity style={styles.card}>
            <Image source={{ uri: item.tripId.coverImage }} style={styles.cardImage} />
            <View style={styles.cardContent}>
                <View style={styles.cardHeader}>
                    <Text style={styles.tripTitle} numberOfLines={1}>{item.tripId.title}</Text>
                    <View style={[styles.statusBadge, item.status === 'confirmed' ? styles.confirmed : styles.pending]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                </View>

                <View style={styles.detailsRow}>
                    <View style={styles.detail}>
                        <Calendar size={14} color="#666" />
                        <Text style={styles.detailText}>
                            {new Date(item.tripId.startDate).toLocaleDateString()}
                        </Text>
                    </View>
                    <View style={styles.detail}>
                        <MapPin size={14} color="#666" />
                        <Text style={styles.detailText}>{item.tripId.destination}</Text>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text style={styles.price}>₹{item.amount.toLocaleString()}</Text>
                    <TouchableOpacity style={styles.viewBtn}>
                        <Text style={styles.viewBtnText}>View Details</Text>
                        <ChevronRight size={16} color="#047857" />
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.tabBar}>
                {TABS.map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[styles.tab, activeTab === tab && styles.activeTab]}
                        onPress={() => setActiveTab(tab)}
                    >
                        <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>{tab}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <FlatList
                data={bookings}
                keyExtractor={(item: any) => item._id}
                renderItem={renderBookingItem}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => fetchBookings()} />
                }
                ListEmptyComponent={!loading ? (
                    <EmptyState
                        title="No Bookings Yet"
                        message={`You have no ${activeTab.toLowerCase()} adventures. Time to plan one!`}
                    />
                ) : null}
                ListFooterComponent={loading ? <Loader /> : null}
                contentContainerStyle={styles.listContent}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f9fafb',
    },
    tabBar: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingTop: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f3f4f6',
    },
    tab: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    activeTab: {
        borderBottomColor: '#047857',
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6b7280',
    },
    activeTabText: {
        color: '#047857',
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        marginBottom: 16,
        flexDirection: 'row',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#f3f4f6',
    },
    cardImage: {
        width: 100,
        height: '100%',
        backgroundColor: '#f3f4f6',
    },
    cardContent: {
        flex: 1,
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    tripTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginRight: 8,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    confirmed: {
        backgroundColor: '#ecfdf5',
    },
    pending: {
        backgroundColor: '#fffbeb',
    },
    statusText: {
        fontSize: 10,
        fontWeight: '700',
        textTransform: 'uppercase',
        color: '#065f46',
    },
    detailsRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    detail: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    detailText: {
        fontSize: 12,
        color: '#6b7280',
    },
    footer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    price: {
        fontSize: 16,
        fontWeight: '800',
        color: '#111827',
    },
    viewBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    viewBtnText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#047857',
    },
});

export default MyBookingsScreen;
