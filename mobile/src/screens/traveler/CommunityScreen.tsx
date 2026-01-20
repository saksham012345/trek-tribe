import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    FlatList,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    KeyboardAvoidingView,
    Platform,
    Image
} from 'react-native';
import { Send, MapPin, Users, Info } from 'lucide-react-native';
import { useAuth } from '../../contexts/AuthContext';
import Loader from '../../components/ui/Loader';

const CommunityScreen: React.FC = () => {
    const { user } = useAuth();
    const [message, setMessage] = useState('');
    const [messages, setMessages] = useState<any[]>([
        { id: '1', user: 'Saksham', text: 'Hey everyone! Is the pickup still at 8 AM?', time: '10:30 AM', role: 'organizer' },
        { id: '2', user: 'Ananya', text: 'Yes, looking forward to it!', time: '10:35 AM', role: 'traveler' },
    ]);

    const handleSend = () => {
        if (!message.trim()) return;

        const newMessage = {
            id: Date.now().toString(),
            user: user?.name,
            text: message,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            role: user?.role
        };

        setMessages([...messages, newMessage]);
        setMessage('');
    };

    const renderMessage = ({ item }: any) => {
        const isMe = item.user === user?.name;

        return (
            <View style={[styles.messageBubble, isMe ? styles.myMessage : styles.theirMessage]}>
                {!isMe && (
                    <View style={styles.senderHeader}>
                        <Text style={styles.senderName}>{item.user}</Text>
                        {item.role === 'organizer' && (
                            <View style={styles.organizerBadge}>
                                <Text style={styles.badgeText}>Org</Text>
                            </View>
                        )}
                    </View>
                )}
                <Text style={[styles.messageText, isMe && styles.myMessageText]}>{item.text}</Text>
                <Text style={[styles.messageTime, isMe && styles.myMessageTime]}>{item.time}</Text>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
            <View style={styles.chatHeader}>
                <Image
                    source={{ uri: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b' }}
                    style={styles.tripThumb}
                />
                <View style={styles.headerInfo}>
                    <Text style={styles.tripName}>Manali Adventure</Text>
                    <View style={styles.headerStats}>
                        <Users size={12} color="#6b7280" />
                        <Text style={styles.headerStatsText}>12 Participants</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.infoBtn}>
                    <Info size={24} color="#047857" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={messages}
                keyExtractor={(item) => item.id}
                renderItem={renderMessage}
                contentContainerStyle={styles.messageList}
                inverted={false}
            />

            <View style={styles.inputBar}>
                <TextInput
                    style={styles.input}
                    placeholder="Type a message..."
                    value={message}
                    onChangeText={setMessage}
                    multiline
                />
                <TouchableOpacity
                    style={[styles.sendBtn, !message.trim() && styles.disabledSend]}
                    onPress={handleSend}
                    disabled={!message.trim()}
                >
                    <Send size={20} color="#fff" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f3f4f6',
    },
    chatHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    tripThumb: {
        width: 40,
        height: 40,
        borderRadius: 8,
        marginRight: 12,
    },
    headerInfo: {
        flex: 1,
    },
    tripName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    headerStats: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    headerStatsText: {
        fontSize: 12,
        color: '#6b7280',
    },
    infoBtn: {
        padding: 8,
    },
    messageList: {
        padding: 16,
        flexGrow: 1,
    },
    messageBubble: {
        maxWidth: '80%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 12,
    },
    myMessage: {
        alignSelf: 'flex-end',
        backgroundColor: '#047857',
        borderBottomRightRadius: 4,
    },
    theirMessage: {
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        borderBottomLeftRadius: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    senderHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    senderName: {
        fontSize: 12,
        fontWeight: '700',
        color: '#374151',
    },
    organizerBadge: {
        backgroundColor: '#fef2f2',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    badgeText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#dc2626',
        textTransform: 'uppercase',
    },
    messageText: {
        fontSize: 15,
        lineHeight: 20,
        color: '#374151',
    },
    myMessageText: {
        color: '#fff',
    },
    messageTime: {
        fontSize: 10,
        color: '#9ca3af',
        alignSelf: 'flex-end',
        marginTop: 4,
    },
    myMessageTime: {
        color: 'rgba(255,255,255,0.7)',
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#e5e7eb',
        gap: 12,
    },
    input: {
        flex: 1,
        backgroundColor: '#f9fafb',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        maxHeight: 100,
        fontSize: 15,
        color: '#111827',
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#047857',
        justifyContent: 'center',
        alignItems: 'center',
    },
    disabledSend: {
        backgroundColor: '#9ca3af',
    },
});

export default CommunityScreen;
