import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    Linking,
    Alert
} from 'react-native';
import { Phone, Mail, MessageSquare, ChevronRight, User } from 'lucide-react-native';
import apiClient from '../../api/client';
import Loader from '../../components/ui/Loader';
import EmptyState from '../../components/ui/EmptyState';

const LeadManagementScreen: React.FC = () => {
    const [leads, setLeads] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchLeads();
    }, []);

    const fetchLeads = async () => {
        try {
            const response = await apiClient.get('/crm/leads');
            setLeads(response.data.leads || []);
        } catch (error) {
            console.error('Failed to fetch leads:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleContact = (type: 'phone' | 'email', value: string) => {
        const url = type === 'phone' ? `tel:${value}` : `mailto:${value}`;
        Linking.openURL(url).catch(err => Alert.alert('Error', 'Could not open contact method'));
    };

    const renderLead = ({ item }: any) => {
        const leadName = item.userId?.name || item.name || 'Anonymous';
        const leadEmail = item.userId?.email || item.email;
        const leadPhone = item.phone || 'No phone';

        return (
            <View style={styles.leadCard}>
                <View style={styles.leadHeader}>
                    <View style={styles.userIcon}>
                        <User size={24} color="#6366f1" />
                    </View>
                    <View style={styles.leadInfo}>
                        <Text style={styles.leadName}>{leadName}</Text>
                        <Text style={styles.tripTarget}>{item.tripId?.title || 'General Inquiry'}</Text>
                    </View>
                    <View style={styles.scoreBadge}>
                        <Text style={styles.scoreText}>{item.leadScore || 0}</Text>
                    </View>
                    <View style={[styles.statusBadge, styles[item.status as keyof typeof styles] as any || styles.new]}>
                        <Text style={styles.statusText}>{item.status}</Text>
                    </View>
                </View>

                {item.metadata?.inquiryMessage ? (
                    <Text style={styles.message} numberOfLines={2}>"{item.metadata.inquiryMessage}"</Text>
                ) : (
                    <Text style={[styles.message, { fontStyle: 'italic', color: '#94a3b8' }]}>No message provided</Text>
                )}

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleContact('phone', leadPhone)}
                    >
                        <Phone size={18} color="#4f46e5" />
                        <Text style={styles.actionText}>Call</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleContact('email', leadEmail)}
                    >
                        <Mail size={18} color="#4f46e5" />
                        <Text style={styles.actionText}>Email</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={[styles.actionBtn, styles.primaryAction]}>
                        <MessageSquare size={18} color="#fff" />
                        <Text style={[styles.actionText, { color: '#fff' }]}>Chat</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <FlatList
                data={leads}
                keyExtractor={(item) => item._id}
                renderItem={renderLead}
                ListEmptyComponent={!loading ? <EmptyState title="No Leads Found" message="Try marketing your trips to get more inquiries!" /> : null}
                ListFooterComponent={loading ? <Loader /> : null}
                contentContainerStyle={styles.listContent}
                onRefresh={fetchLeads}
                refreshing={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    listContent: {
        padding: 20,
    },
    leadCard: {
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    leadHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    userIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#eef2ff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    leadInfo: {
        flex: 1,
    },
    leadName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0f172a',
    },
    tripTarget: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    new: { backgroundColor: '#f0f9ff' },
    contacted: { backgroundColor: '#fef3c7' },
    converted: { backgroundColor: '#f0fdf4' },
    statusText: {
        fontSize: 10,
        fontWeight: '800',
        textTransform: 'uppercase',
        color: '#1e293b',
    },
    message: {
        fontSize: 14,
        color: '#475569',
        fontStyle: 'italic',
        marginBottom: 20,
        lineHeight: 20,
    },
    actionRow: {
        flexDirection: 'row',
        gap: 12,
    },
    actionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    primaryAction: {
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
    },
    actionText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4f46e5',
    },
    scoreBadge: {
        backgroundColor: '#4f46e5',
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 8,
    },
    scoreText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
});

export default LeadManagementScreen;
