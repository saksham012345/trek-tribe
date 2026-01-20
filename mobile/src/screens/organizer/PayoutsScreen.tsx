import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    FlatList
} from 'react-native';
import { CreditCard, IndianRupee, Clock, CheckCircle2, QrCode, ArrowUpRight } from 'lucide-react-native';
import apiClient from '../../api/client';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';

const PayoutsScreen: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [payouts, setPayouts] = useState<any[]>([]);

    useEffect(() => {
        fetchPayouts();
    }, []);

    const fetchPayouts = async () => {
        try {
            const response = await apiClient.get('/subscriptions/payment-history');
            setPayouts(response.data.payments || []);
        } catch (error) {
            console.error('Failed to fetch payouts:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderPayout = ({ item }: any) => (
        <View style={styles.payoutCard}>
            <View style={styles.payoutIcon}>
                <IndianRupee size={20} color="#059669" />
            </View>
            <View style={styles.payoutInfo}>
                <Text style={styles.payoutPlan}>{item.plan || 'Subscription'}</Text>
                <Text style={styles.payoutDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
            </View>
            <View style={styles.payoutAmountBox}>
                <Text style={styles.payoutAmount}>₹{item.amount.toLocaleString()}</Text>
                <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{item.status}</Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.balanceCard}>
                <Text style={styles.balanceLabel}>Next Settlement</Text>
                <Text style={styles.balanceValue}>₹14,500.00</Text>
                <View style={styles.balanceFooter}>
                    <Clock size={14} color="#fff" />
                    <Text style={styles.balanceDate}>Scheduled for 20th Jan</Text>
                </View>
                <TouchableOpacity style={styles.qrBtn}>
                    <QrCode size={20} color="#4f46e5" />
                    <Text style={styles.qrBtnText}>My Payment QR</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Recent Settlements</Text>
                <FlatList
                    data={payouts}
                    keyExtractor={(item: any) => item.id}
                    renderItem={renderPayout}
                    ListEmptyComponent={!loading ? <EmptyState title="No History" message="Your settlement history will appear here." /> : null}
                    ListFooterComponent={loading ? <Loader /> : null}
                    contentContainerStyle={styles.listContent}
                    onRefresh={fetchPayouts}
                    refreshing={false}
                />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    balanceCard: {
        margin: 20,
        backgroundColor: '#4f46e5',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#4f46e5',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 8,
    },
    balanceLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    balanceValue: {
        fontSize: 36,
        fontWeight: '800',
        color: '#fff',
        marginTop: 8,
        marginBottom: 16,
    },
    balanceFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    balanceDate: {
        fontSize: 14,
        color: '#fff',
        opacity: 0.9,
    },
    qrBtn: {
        position: 'absolute',
        top: 24,
        right: 24,
        backgroundColor: '#fff',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    qrBtnText: {
        color: '#4f46e5',
        fontWeight: '700',
        fontSize: 12,
    },
    section: {
        flex: 1,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0f172a',
        marginBottom: 16,
    },
    listContent: {
        paddingBottom: 40,
    },
    payoutCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#f1f5f9',
    },
    payoutIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#ecfdf5',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    payoutInfo: {
        flex: 1,
    },
    payoutPlan: {
        fontSize: 16,
        fontWeight: '700',
        color: '#1e293b',
    },
    payoutDate: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    payoutAmountBox: {
        alignItems: 'flex-end',
    },
    payoutAmount: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1e293b',
    },
    statusBadge: {
        marginTop: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#059669',
        textTransform: 'uppercase',
    },
});

export default PayoutsScreen;
