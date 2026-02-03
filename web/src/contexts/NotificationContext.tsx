import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import io, { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';

interface Notification {
    id: string;
    message: string;
    type: 'success' | 'info' | 'error' | 'warning';
    timestamp: Date;
    read: boolean;
    link?: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    socket: any | null;
    addNotification: (message: string, type?: Notification['type'], link?: string) => void;
    markAsRead: (id: string) => void;
    markAllAsRead: () => void;
    removeNotification: (id: string) => void;
    clearAll: () => void;
    isConnected: boolean;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [socket, setSocket] = useState<any | null>(null);
    const [isConnected, setIsConnected] = useState(false);

    // Derive unread count
    const unreadCount = notifications.filter(n => !n.read).length;

    useEffect(() => {
        let newSocket: any | null = null;

        if (user) {
            try {
                const socketUrl = process.env.REACT_APP_API_URL || process.env.REACT_APP_SOCKET_URL || window.location.origin;

                console.log('🔌 Initializing socket connection for notifications to:', socketUrl);

                const token = localStorage.getItem('token');

                newSocket = io(socketUrl, {
                    path: '/socket.io/',
                    transports: ['websocket', 'polling'],
                    withCredentials: true,
                    auth: {
                        token: token
                    },
                    extraHeaders: {
                        Authorization: token ? `Bearer ${token}` : ''
                    },
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                } as any);

                newSocket.on('connect', () => {
                    console.log('✅ Socket connected successfully');
                    setIsConnected(true);
                });

                newSocket.on('disconnect', () => {
                    console.warn('🔌 Socket disconnected');
                    setIsConnected(false);
                });

                newSocket.on('connect_error', (err) => {
                    console.error('❌ Socket connection error:', err);
                    setIsConnected(false);
                });

                newSocket.on('notification', (data: any) => {
                    console.log('🔔 Received notification:', data);
                    addNotification(data.message || 'New notification', data.type || 'info', data.link);
                });

                newSocket.on('booking_update', (data: any) => {
                    addNotification(`Booking update: ${data.message}`, 'info', data.link);
                });

                newSocket.on('payment_verified', () => {
                    addNotification('Payment verified! Your booking is confirmed.', 'success', `/my-bookings`);
                });

                newSocket.on('trip_update', (data: any) => {
                    addNotification(`Trip update: ${data.message}`, 'info', data.link);
                });

                setSocket(newSocket);
            } catch (error) {
                console.error('CRITICAL: Error creating socket connection:', error);
            }
        }

        return () => {
            if (newSocket) {
                console.log('🔌 Disconnecting socket cleanup');
                newSocket.disconnect();
            }
        };
    }, [user]);

    const addNotification = (message: string, type: Notification['type'] = 'info', link?: string) => {
        const notification: Notification = {
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            message,
            type,
            timestamp: new Date(),
            read: false,
            link
        };

        setNotifications(prev => [notification, ...prev].slice(0, 50));
    };

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const clearAll = () => {
        setNotifications([]);
    };

    return (
        <NotificationContext.Provider value={{
            notifications,
            unreadCount,
            socket,
            addNotification,
            markAsRead,
            markAllAsRead,
            removeNotification,
            clearAll,
            isConnected
        }}>
            {children}
        </NotificationContext.Provider>
    );
};
