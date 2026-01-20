import { io, Socket } from 'socket.io-client';
import CONFIG from '../config';
import * as SecureStore from 'expo-secure-store';

/**
 * Socket.io Service for Mobile
 * Handles: Real-time chat, Booking updates, Slot availability
 */
class SocketService {
    private socket: Socket | null = null;

    connect() {
        if (this.socket?.connected) return;

        this.socket = io(CONFIG.SOCKET_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        this.socket.on('connect', () => {
            console.log('Mobile Socket Connected:', this.socket?.id);
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Mobile Socket Disconnected:', reason);
        });

        this.socket.on('connect_error', (error) => {
            console.error('Socket Connection Error:', error);
        });
    }

    // Auth: Identify socket connection with user
    authenticate(userId: string) {
        if (this.socket) {
            this.socket.emit('authenticate', userId);
        }
    }

    // Messaging
    joinTripGroup(tripId: string) {
        this.socket?.emit('join_trip_chat', { tripId });
    }

    sendMessage(tripId: string, message: any) {
        this.socket?.emit('send_trip_message', { tripId, message });
    }

    onMessage(callback: (msg: any) => void) {
        this.socket?.on('new_trip_message', callback);
    }

    // Booking & Slots
    onSlotUpdate(callback: (data: { tripId: string, availableSlots: number }) => void) {
        this.socket?.on('slot_update', callback);
    }

    disconnect() {
        this.socket?.disconnect();
        this.socket = null;
    }
}

export default new SocketService();
