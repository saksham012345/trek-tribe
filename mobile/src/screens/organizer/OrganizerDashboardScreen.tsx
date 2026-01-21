import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    RefreshControl,
    Dimensions,
    StatusBar
} from 'react-native';
import {
    ChevronRight,
    CreditCard,
    Camera,
    IndianRupee,
    TrendingUp,
    Target,
    BarChart3,
    Plus,
    Users
} from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import apiClient from '../../api/client';
import Loader from '../../components/ui/Loader';
import { COLORS, SHADOWS, RADIUS, SPACING } from '../../theme/DesignSystem';
import GlassCard from '../../components/ui/GlassCard';

const { width } = Dimensions.get('window');

const StatCard: React.FC<{
    title: string;
    value: string;
    icon: any;
    color: string;
    trend?: string
}> = ({ title, value, icon: Icon, color, trend }) => (
    <GlassCard style={styles.statCard}>
        <View style={styles.statHeader}>
            <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
                <Icon size={20} color={color} />
            </View>
            {trend && <Text style={[styles.trendText, { color }]}>{trend}</Text>}
        </View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statTitle}>{title}</Text>
    </GlassCard>
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
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="#fff" />
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchDashboardData} colors={[COLORS.primary]} />}
            >
                <View style={styles.header}>
                    <View>
                        <Text style={styles.welcomeText}>Business Hub</Text>
                        <Text style={styles.dateText}>{new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
                    </View>
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.postMomentBtn}
                            onPress={() => alert('Feature coming soon: Share a moment with your tribe!')}
                        >
                            <Camera size={20} color={COLORS.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.createBtn}
                            onPress={() => navigation.navigate('CreateTrip')}
                        >
                            <Plus size={20} color="#fff" />
                            <Text style={styles.createBtnText}>Trip</Text>
                        </TouchableOpacity>
                    </View>
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
                        color={COLORS.primary}
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
                    <GlassCard style={styles.metricsBox}>
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
                    </GlassCard>
                </View>

                {/* Quick Actions */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quick Actions</Text>
                    <View style={styles.quickActionsGrid}>
                        <TouchableOpacity
                            style={styles.quickActionCardWrapper}
                            onPress={() => navigation.navigate('VerifyPayments')}
                        >
                            <GlassCard style={styles.quickActionCard}>
                                <View style={[styles.actionIconContainer, { backgroundColor: '#f0fdf4' }]}>
                                    <CreditCard size={24} color={COLORS.secondary} />
                                </View>
                                <Text style={styles.actionLabel}>Verify Payments</Text>
                            </GlassCard>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.quickActionCardWrapper}
                            onPress={() => navigation.navigate('CreateTrip')}
                        >
                            <GlassCard style={styles.quickActionCard}>
                                <View style={[styles.actionIconContainer, { backgroundColor: '#f5f3ff' }]}>
                                    <Plus size={24} color="#4f46e5" />
                                </View>
                                <Text style={styles.actionLabel}>New Trip</Text>
                            </GlassCard>
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
                                onPress={() => navigation.navigate('VerifyPayments')}
                            >
                                <GlassCard style={styles.activityItem}>
                                    <View style={styles.activityIcon}>
                                        <Users size={20} color={COLORS.primary} />
                                    </View>
                                    <View style={styles.activityContent}>
                                        <Text style={styles.activityTitle}>{booking.travelerName}</Text>
                                        <Text style={styles.activitySub}>{booking.tripTitle}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                                        <Text style={styles.activityTime}>{booking.status}</Text>
                                        <Text style={[styles.activitySub, { fontWeight: '700', color: COLORS.text }]}>₹{booking.amount}</Text>
                                    </View>
                                    <ChevronRight size={18} color={COLORS.textLight} />
                                </GlassCard>
                            </TouchableOpacity>
                        ))
                    ) : (
                        <Text style={styles.placeholderText}>No recent bookings yet</Text>
                    )}
                </View>
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 40,
        paddingBottom: 24,
        backgroundColor: '#fff',
        borderBottomLeftRadius: 32,
        borderBottomRightRadius: 32,
        ...SHADOWS.md,
        marginBottom: 8,
    },
    welcomeText: {
        fontSize: 26,
        fontWeight: '900',
        color: COLORS.text,
        letterSpacing: -0.5,
    },
    dateText: {
        fontSize: 14,
        color: COLORS.textLight,
        fontWeight: '500',
        marginTop: 4,
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    postMomentBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#f0fdf4',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(15, 118, 110, 0.1)',
    },
    createBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: COLORS.primary,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 14,
        gap: 6,
        ...SHADOWS.colored,
    },
    createBtnText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        padding: 16,
        gap: 12,
    },
    statCard: {
        width: (width - 44) / 2,
        padding: 16,
        backgroundColor: '#fff',
    },
    statHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    trendText: {
        fontSize: 12,
        fontWeight: '700',
    },
    statValue: {
        fontSize: 22,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 4,
    },
    statTitle: {
        fontSize: 12,
        color: COLORS.textLight,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    section: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 8,
    },
    seeAll: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 14,
    },
    metricsBox: {
        flexDirection: 'row',
        backgroundColor: '#fff',
        padding: 24,
        alignItems: 'center',
    },
    metricItem: {
        flex: 1,
        alignItems: 'center',
    },
    metricDivider: {
        width: 1,
        height: 50,
        backgroundColor: COLORS.border,
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
        fontSize: 24,
        fontWeight: '800',
        color: COLORS.text,
        marginBottom: 4,
    },
    metricLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: COLORS.textLight,
    },
    metricSub: {
        fontSize: 11,
        color: COLORS.textLighter,
        marginTop: 2,
        fontWeight: '500',
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        padding: 16,
        marginBottom: 12,
    },
    activityIcon: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: '#f0fdf4',
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
        color: COLORS.text,
    },
    activitySub: {
        fontSize: 13,
        color: COLORS.textLight,
        marginTop: 2,
    },
    activityTime: {
        fontSize: 12,
        color: COLORS.textLighter,
        marginRight: 8,
        textTransform: 'capitalize',
        fontWeight: '600',
    },
    quickActionsGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    quickActionCardWrapper: {
        flex: 1,
    },
    quickActionCard: {
        backgroundColor: '#fff',
        padding: 20,
        alignItems: 'center',
    },
    actionIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    actionLabel: {
        fontSize: 14,
        fontWeight: '700',
        color: COLORS.text,
        textAlign: 'center',
    },
    placeholderText: {
        fontSize: 14,
        color: COLORS.textLighter,
        textAlign: 'center',
        padding: 40,
        fontWeight: '500',
    },
});

export default OrganizerDashboardScreen;
