import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    ScrollView,
    Alert
} from 'react-native';
import { MessageCircle, X, Send, HelpCircle, Ticket as TicketIcon } from 'lucide-react-native';
import apiClient from '../api/client';

const SupportWidget: React.FC = () => {
    const [visible, setVisible] = useState(false);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmitTicket = async () => {
        if (!subject || !message) {
            Alert.alert('Error', 'Please fill in both subject and message');
            return;
        }

        setLoading(true);
        try {
            await apiClient.post('/crm/tickets', { subject, message, priority: 'medium' });
            Alert.alert('Success', 'Your support ticket has been created! Our team will get back to you soon.');
            setSubject('');
            setMessage('');
            setVisible(false);
        } catch (error) {
            console.error('Failed to create ticket:', error);
            Alert.alert('Error', 'Failed to create ticket. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.floatingBtn}
                onPress={() => setVisible(true)}
            >
                <MessageCircle size={28} color="#fff" />
            </TouchableOpacity>

            <Modal
                visible={visible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.header}>
                            <View style={styles.titleRow}>
                                <HelpCircle size={24} color="#047857" />
                                <Text style={styles.title}>Trek Tribe Support</Text>
                            </View>
                            <TouchableOpacity onPress={() => setVisible(false)}>
                                <X size={24} color="#666" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView contentContainerStyle={styles.form}>
                            <Text style={styles.intro}>Need help with a trip or your account? Raise a ticket below.</Text>

                            <Text style={styles.label}>Subject</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="What do you need help with?"
                                value={subject}
                                onChangeText={setSubject}
                            />

                            <Text style={styles.label}>Message</Text>
                            <TextInput
                                style={[styles.input, styles.textArea]}
                                placeholder="Describe your issue in detail..."
                                multiline
                                numberOfLines={6}
                                value={message}
                                onChangeText={setMessage}
                            />

                            <TouchableOpacity
                                style={[styles.submitBtn, loading && styles.disabledBtn]}
                                onPress={handleSubmitTicket}
                                disabled={loading}
                            >
                                <TicketIcon size={20} color="#fff" />
                                <Text style={styles.submitBtnText}>{loading ? 'Creating...' : 'Create Support Ticket'}</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 20,
        right: 20,
        zIndex: 999,
    },
    floatingBtn: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#047857',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 32,
        borderTopRightRadius: 32,
        minHeight: '60%',
        padding: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0f172a',
    },
    form: {
        paddingBottom: 40,
    },
    intro: {
        fontSize: 14,
        color: '#64748b',
        lineHeight: 20,
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 16,
        fontSize: 15,
        color: '#1e293b',
        marginBottom: 20,
    },
    textArea: {
        height: 150,
        textAlignVertical: 'top',
    },
    submitBtn: {
        backgroundColor: '#047857',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
        borderRadius: 16,
        gap: 10,
        marginTop: 10,
    },
    submitBtnText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: 'bold',
    },
    disabledBtn: {
        opacity: 0.6,
    },
});

export default SupportWidget;
