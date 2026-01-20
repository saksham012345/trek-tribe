import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Dimensions
} from 'react-native';
import {
    Plus,
    TrendingUp,
    Target,
    IndianRupee,
    BarChart3,
    Users,
    Star,
    ChevronRight,
    CreditCard
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import Loader from '../../components/ui/Loader';

const { width } = Dimensions.get('window');

const StatCard: React.FC<{
    title: string;
    value: string;
    icon: any;
    color: string;
    trend?: string
}> = ({ title, value, icon: Icon, color, trend }) => (
    <View style={styles.statCard}>
        <View style={styles.statHeader}>
            <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                <Icon size={20} color={color} />
            </View>
            {trend && <Text style={styles.trendText}>{trend}</Text>}
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
    </View>
);

const OrganizerDashboardScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [analytics, setAnalytics] = useState<any>(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/dashboard/organizer');
            setAnalytics(response.data);
        } catch (error) {
            console.error('Failed to fetch dashboard data:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    if (loading && !refreshing) return <Loader fullScreen message="Crunching numbers..." />;

    const summary = analytics?.summary;

    return (
        <ScrollView
            style={styles.container}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDashboardData} />}
        >
            <View style={styles.header}>
                <View>
                    <Text style={styles.welcomeText}>Business Overview</Text>
                    <Text style={styles.dateText}>{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
                </View>
                <TouchableOpacity
                    style={styles.createBtn}
                    onPress={() => navigation.navigate('CreateTrip')}
                >
                    <Plus size={20} color="#fff" />
                    <Text style={styles.createBtnText}>Create Trip</Text>
                </TouchableOpacity>
            </View>

            {/* Primary Stats Grid */}
            <View style={styles.statsGrid}>
                <StatCard
                    title="Revenue"
                    value={`₹${(summary?.revenue?.monthly || 0).toLocaleString()}`}
                    icon={IndianRupee}
                    color="#4f46e5"
                    trend="+12%"
                />
                <StatCard
                    title="Active Trips"
                    value={String(summary?.trips?.active || 0)}
                    icon={TrendingUp}
                    color="#059669"
                />
                <StatCard
                    title="Total Lead Bookings"
                    value={String(summary?.bookings?.total || 0)}
                    icon={Target}
                    color="#ea580c"
                />
                <StatCard
                    title="Confirmed"
                    value={String(summary?.bookings?.confirmed || 0)}
                    icon={BarChart3}
                    color="#2563eb"
                />
            </View>

            {/* Performance Section */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Performance Metrics</Text>
                <View style={styles.metricsBox}>
                    <View style={styles.metricItem}>
                        <View style={styles.ratingCircle}>
                            <Text style={styles.ratingText}>{summary?.participants?.total || 0}</Text>
                        </View>
                        <Text style={styles.metricLabel}>Total Travelers</Text>
                        <Text style={styles.metricSub}>All-time footprint</Text>
                    </View>
                    <View style={styles.metricDivider} />
                    <View style={styles.metricItem}>
                        <Text style={styles.responseValue}>{summary?.trips?.upcoming || 0}</Text>
                        <Text style={styles.metricLabel}>Upcoming Trips</Text>
                        <Text style={styles.metricSub}>Scheduled departures</Text>
                    </View>
                </View>
            </View>

            {/* Quick Actions */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.quickActionsGrid}>
                    <TouchableOpacity
                        style={styles.quickActionCard}
                        onPress={() => navigation.navigate('VerifyPayments')}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#f0fdf4' }]}>
                            <CreditCard size={24} color="#059669" />
                        </View>
                        <Text style={styles.actionLabel}>Verify Payments</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.quickActionCard}
                        onPress={() => navigation.navigate('CreateTrip')}
                    >
                        <View style={[styles.actionIconContainer, { backgroundColor: '#f5f3ff' }]}>
                            <Plus size={24} color="#4f46e5" />
                        </View>
                        <Text style={styles.actionLabel}>New Trip</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Recent Bookings Section */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Recent Bookings</Text>
                    <TouchableOpacity onPress={() => navigation.navigate('VerifyPayments')}>
                        <Text style={styles.seeAll}>See All</Text>
                    </TouchableOpacity>
                </View>

                {analytics?.recentBookings?.length > 0 ? (
                    analytics.recentBookings.map((booking: any) => (
                        <TouchableOpacity
                            key={booking.id}
                            style={styles.activityItem}
                            onPress={() => navigation.navigate('VerifyPayments')}
                        >
                            <View style={styles.activityIcon}>
                                <Users size={20} color="#4f46e5" />
                            </View>
                            <View style={styles.activityContent}>
                                <Text style={styles.activityTitle}>{booking.travelerName}</Text>
                                <Text style={styles.activitySub}>{booking.tripTitle}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                                <Text style={styles.activityTime}>{booking.status}</Text>
                                <Text style={[styles.activitySub, { fontWeight: '700', color: '#1e293b' }]}>₹{booking.amount}</Text>
                            </View>
                            <ChevronRight size={18} color="#9ca3af" />
                        </TouchableOpacity>
                    ))
                ) : (
                    <Text style={styles.placeholderText}>No recent bookings yet</Text>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 24,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    welcomeText: {
        fontSize: 22,
        fontWeight: '800',
        color: '#0f172a',
    },
    dateText: {
        fontSize: 14,
        color: '#64748b',
        marginTop: 4,
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#4f46e5',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        gap: 8,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 4,
    },
    createBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 12,
        justifyContent: 'space-between',
    },
    statCard: {
        width: (width - 48) / 2,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 2,
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    trendText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#059669',
    },
    statValue: {
        fontSize: 20,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 4,
    },
    statTitle: {
        fontSize: 12,
        color: '#64748b',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    section: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1e293b',
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    seeAll: {
        color: '#4f46e5',
        fontWeight: '600',
    },
    metricsBox: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
    },
    metricDivider: {
        width: 1,
        height: 50,
        backgroundColor: '#f1f5f9',
    },
    ratingCircle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#fffbeb',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginBottom: 8,
    },
    ratingText: {
        fontSize: 18,
        fontWeight: '800',
        color: '#92400e',
    },
    responseValue: {
        fontSize: 22,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 4,
    },
    metricLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: '#64748b',
    },
    metricSub: {
        fontSize: 11,
        color: '#94a3b8',
        marginTop: 2,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    activityIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#f5f3ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    activityContent: {
        flex: 1,
    },
    activityTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e293b',
    },
    activitySub: {
        fontSize: 13,
        color: '#64748b',
        marginTop: 2,
    },
    activityTime: {
        fontSize: 12,
        color: '#94a3b8',
        marginRight: 8,
    },
    quickActionsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    quickActionCard: {
        flex: 1,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
    },
    actionIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    actionLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
    },
    placeholderText: {
        fontSize: 14,
        color: '#94a3b8',
        textAlign: 'center',
        padding: 40,
    },
});

export default OrganizerDashboardScreen;
