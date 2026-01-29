import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Check, AlertCircle, Info, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

// Dynamically import socket.io-client to handle cases where it might not be available
let io: any = null;
let Socket: any = null;

try {
  const socketModule = require('socket.io-client');
  io = socketModule.default || socketModule.io;
  Socket = socketModule.Socket;
} catch (error) {
  console.warn('Socket.io-client not available:', error);
}

interface Notification {
  id: string;
  message: string;
  type: 'success' | 'info' | 'error' | 'warning';
  timestamp: Date;
  read: boolean;
  link?: string;
}

const NotificationCenter: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) {
      initializeSocket();

      // Close dropdown when clicking outside
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        if (socket && typeof socket.disconnect === 'function') {
          socket.disconnect();
        }
      };
    }
  }, [user]);

  useEffect(() => {
    if (notifications.length > 0) {
      const unread = notifications.filter(n => !n.read).length;
      setUnreadCount(unread);
    }
  }, [notifications]);

  const initializeSocket = () => {
    if (!io) {
      console.warn('Socket.io not available for notifications');
      return;
    }

    if (!user) return; // Use user from AuthContext

    try {
      // Cookies are sent automatically, no need to pass token in auth
      const newSocket = io(process.env.REACT_APP_API_URL || process.env.REACT_APP_SOCKET_URL || (typeof window !== 'undefined' ? window.location.origin : ''), {
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        withCredentials: true // Send cookies
      } as any);

      newSocket.on('connect', () => {
        console.log('🔌 Notification center connected');
      });

      newSocket.on('connect_error', (error: any) => {
        console.warn('🔌 Notification center connection error:', error);
      });

      newSocket.on('notification', (data: any) => {
        addNotification(data.message || 'New notification', data.type || 'info', data.link);
      });

      newSocket.on('booking_update', (data: any) => {
        addNotification(`Booking update: ${data.message}`, 'info', data.link);
      });

      newSocket.on('payment_verified', (data: any) => {
        addNotification('Payment verified! Your booking is confirmed.', 'success', `/my-bookings`);
      });

      newSocket.on('trip_update', (data: any) => {
        addNotification(`Trip update: ${data.message}`, 'info', data.link);
      });

      setSocket(newSocket);
    } catch (error) {
      console.error('Error initializing socket:', error);
    }
  };

  const addNotification = (message: string, type: Notification['type'] = 'info', link?: string) => {
    const notification: Notification = {
      id: Date.now().toString(),
      message,
      type,
      timestamp: new Date(),
      read: false,
      link
    };

    setNotifications(prev => [notification, ...prev].slice(0, 50)); // Keep last 50
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

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-600" />;
      default:
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getNotificationColor = (type: Notification['type']) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-800';
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-gray-100 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-forest-700" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 max-h-[600px] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-forest-50 to-nature-50">
            <h3 className="font-bold text-forest-800 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
            </h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-nature-600 hover:text-nature-700 font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 hover:bg-gray-200 rounded-full transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto max-h-[500px]">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No notifications yet</p>
                <p className="text-sm mt-1">You'll see updates here</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer border-l-4 ${!notification.read ? 'bg-blue-50/50 border-blue-500' : 'border-transparent'
                      } ${getNotificationColor(notification.type)}`}
                    onClick={() => {
                      if (!notification.read) markAsRead(notification.id);
                      if (notification.link) {
                        window.location.href = notification.link;
                      }
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium break-words">{notification.message}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {notification.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        {!notification.read && (
                          <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeNotification(notification.id);
                          }}
                          className="p-1 hover:bg-gray-200 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="p-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={clearAll}
                className="w-full text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;

