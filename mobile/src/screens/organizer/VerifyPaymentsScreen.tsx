import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    Image,
    TouchableOpacity,
    Alert,
    Modal
} from 'react-native';
import { CheckCircle, XCircle, Eye, IndianRupee, User, Calendar } from 'lucide-react-native';
import apiClient from '../../api/client';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';

const VerifyPaymentsScreen: React.FC = () => {
    const [bookings, setBookings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProof, setSelectedProof] = useState<string | null>(null);

    useEffect(() => {
        fetchPendingPayments();
    }, []);

    const fetchPendingPayments = async () => {
        try {
            // Assuming endpoint to get bookings with pending proofs
            const response = await apiClient.get('/bookings/organizer/pending-proofs');
            setBookings(response.data.bookings || []);
        } catch (error) {
            console.error('Failed to fetch pending payments:', error);
            // Fallback/Mock for now if endpoint doesn't exist
            setBookings([]);
        } finally {
            setLoading(false);
        }
    };

    const handleVerify = async (bookingId: string, status: 'confirmed' | 'rejected') => {
        Alert.alert(
            status === 'confirmed' ? 'Verify Payment' : 'Reject Payment',
            `Are you sure you want to ${status} this payment?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: status === 'confirmed' ? 'Confirm' : 'Reject',
                    style: status === 'confirmed' ? 'default' : 'destructive',
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await apiClient.patch(`/bookings/${bookingId}/status`, { status });
                            Alert.alert('Success', `Payment ${status}`);
                            fetchPendingPayments();
                        } catch (error) {
                            Alert.alert('Error', 'Failed to update status');
                        } finally {
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderBookingItem = ({ item }: { item: any }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <View>
                    <Text style={styles.tripTitle}>{item.tripId?.title}</Text>
                    <View style={styles.row}>
                        <User size={14} color="#666" />
                        <Text style={styles.userName}>{item.travelerDetails?.[0]?.name || 'Traveler'}</Text>
                    </View>
                </View>
                <Text style={styles.amount}>₹{item.totalAmount?.toLocaleString()}</Text>
            </View>

            <View style={styles.infoRow}>
                <View style={styles.infoBox}>
                    <Calendar size={14} color="#666" />
                    <Text style={styles.infoText}>Booking: {new Date(item.createdAt).toLocaleDateString()}</Text>
                </View>
            </View>

            {item.paymentScreenshot ? (
                <TouchableOpacity
                    style={styles.proofPreview}
                    onPress={() => setSelectedProof(item.paymentScreenshot)}
                >
                    <Image source={{ uri: item.paymentScreenshot }} style={styles.proofImg} />
                    <View style={styles.eyeOverlay}>
                        <Eye size={20} color="#fff" />
                        <Text style={styles.eyeText}>View Proof</Text>
                    </View>
                </TouchableOpacity>
            ) : (
                <View style={styles.noProof}>
                    <Text style={styles.noProofText}>No screenshot uploaded yet</Text>
                </View>
            )}

            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.actionBtn, styles.rejectBtn]}
                    onPress={() => handleVerify(item._id, 'rejected')}
                >
                    <XCircle size={20} color="#ef4444" />
                    <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionBtn, styles.approveBtn]}
                    onPress={() => handleVerify(item._id, 'confirmed')}
                >
                    <CheckCircle size={20} color="#059669" />
                    <Text style={styles.approveText}>Approve</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading && bookings.length === 0) return <Loader fullScreen message="Loading payments..." />;

    return (
        <View style={styles.container}>
            <FlatList
                data={bookings}
                keyExtractor={(item) => item._id}
                renderItem={renderBookingItem}
                contentContainerStyle={styles.list}
                ListEmptyComponent={
                    <EmptyState
                        title="All Caught Up!"
                        message="No pending payment verifications for your trips."
                        icon={<CheckCircle size={48} color="#047857" />}
                    />
                }
                refreshing={loading}
                onRefresh={fetchPendingPayments}
            />

            <Modal visible={!!selectedProof} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={styles.closeArea} onPress={() => setSelectedProof(null)} />
                    <View style={styles.modalContent}>
                        <Image source={{ uri: selectedProof || '' }} style={styles.fullImage} resizeMode="contain" />
                        <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedProof(null)}>
                            <Text style={styles.closeBtnText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    list: {
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    tripTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#1e293b',
        marginBottom: 4,
    },
    userName: {
        fontSize: 14,
        color: '#64748b',
        fontWeight: '500',
    },
    amount: {
        fontSize: 20,
        fontWeight: '900',
        color: '#4f46e5',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    infoRow: {
        marginBottom: 16,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#f1f5f9',
        padding: 8,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    infoText: {
        fontSize: 12,
        color: '#475569',
    },
    proofPreview: {
        width: '100%',
        height: 150,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
        position: 'relative',
    },
    proofImg: {
        width: '100%',
        height: '100%',
        backgroundColor: '#f1f5f9',
    },
    eyeOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        flexDirection: 'row',
        gap: 8,
    },
    eyeText: {
        color: '#fff',
        fontWeight: '700',
    },
    noProof: {
        backgroundColor: '#fff7ed',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#ffedd5',
    },
    noProofText: {
        color: '#c2410c',
        fontSize: 14,
        fontWeight: '500',
    },
    actions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    approveBtn: {
        borderColor: '#059669',
        backgroundColor: '#f0fdf4',
    },
    approveText: {
        color: '#059669',
        fontWeight: '700',
    },
    rejectBtn: {
        borderColor: '#ef4444',
        backgroundColor: '#fef2f2',
    },
    rejectText: {
        color: '#ef4444',
        fontWeight: '700',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'center',
    },
    closeArea: {
        ...StyleSheet.absoluteFillObject,
    },
    modalContent: {
        flex: 1,
        justifyContent: 'center',
        padding: 20,
    },
    fullImage: {
        width: '100%',
        height: '80%',
    },
    closeBtn: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 16,
        alignItems: 'center',
        marginTop: 20,
    },
    closeBtnText: {
        color: '#000',
        fontWeight: '800',
        fontSize: 16,
    },
});

export default VerifyPaymentsScreen;
