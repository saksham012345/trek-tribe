const io = require('socket.io-client');
type Socket = any;

interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'agent';
  content: string;
  messageType: 'text' | 'file' | 'system';
  timestamp: Date;
  readBy: string[];
}

interface TypingIndicator {
  roomId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

interface ChatRoom {
  id: string;
  participants: string[];
  status: 'waiting' | 'active' | 'closed';
  assignedAgent?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  createdAt: Date;
  updatedAt: Date;
}

interface SocketEvents {
  // Client -> Server events
  'join_room': (roomId: string) => void;
  'leave_room': (roomId: string) => void;
  'send_message': (data: { roomId: string; content: string; messageType?: 'text' | 'file' }) => void;
  'typing_start': (roomId: string) => void;
  'typing_stop': (roomId: string) => void;
  'mark_read': (data: { roomId: string; messageIds: string[] }) => void;
  'agent_take_chat': (roomId: string) => void;
  'agent_transfer_chat': (data: { roomId: string; targetAgentId?: string; reason: string }) => void;
  'close_chat': (data: { roomId: string; reason?: string; satisfaction?: number }) => void;

  // Server -> Client events
  'message_received': (message: ChatMessage) => void;
  'typing_indicator': (data: TypingIndicator) => void;
  'chat_assigned': (data: { roomId: string; agentId: string; agentName: string }) => void;
  'chat_transferred': (data: { roomId: string; fromAgent: string; toAgent: string; reason: string }) => void;
  'chat_closed': (data: { roomId: string; closedBy: string; reason?: string }) => void;
  'user_joined': (data: { roomId: string; userId: string; userName: string }) => void;
  'user_left': (data: { roomId: string; userId: string; userName: string }) => void;
  'agent_status_update': (data: { agentId: string; status: 'online' | 'busy' | 'offline' }) => void;
  'error': (error: { message: string; code?: string }) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private authToken: string | null = null;
  private userId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  initialize(token: string, userId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.authToken = token;
      this.userId = userId;

      // Get API URL from environment or default
      const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

      this.socket = io(API_URL, {
        auth: {
          token: this.authToken,
          userId: this.userId
        },
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket connected:', this.socket?.id);
        this.reconnectAttempts = 0;
        resolve();
      });

      this.socket.on('connect_error', (error: any) => {
        console.error('❌ Socket connection error:', error);
        this.reconnectAttempts++;
        
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
          reject(new Error('Failed to connect to chat server after multiple attempts'));
        }
      });

      this.socket.on('disconnect', (reason: any) => {
        console.log('🔌 Socket disconnected:', reason);
        
        // Attempt to reconnect if it wasn't intentional
        if (reason !== 'io client disconnect') {
          this.attemptReconnect();
        }
      });

      this.socket.on('error', (error: any) => {
        console.error('🚨 Socket error:', error);
      });

      this.socket.on('authentication_failed', (error: any) => {
        console.error('🔐 Authentication failed:', error);
        reject(new Error('Authentication failed: ' + error.message));
      });
    });
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts && this.authToken && this.userId) {
      console.log(`🔄 Attempting to reconnect... (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
      this.reconnectAttempts++;
      
      setTimeout(() => {
        this.initialize(this.authToken!, this.userId!).catch(console.error);
      }, Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000));
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.authToken = null;
    this.userId = null;
    this.reconnectAttempts = 0;
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Room Management
  joinRoom(roomId: string): void {
    if (this.socket) {
      this.socket.emit('join_room', roomId);
    }
  }

  leaveRoom(roomId: string): void {
    if (this.socket) {
      this.socket.emit('leave_room', roomId);
    }
  }

  // Messaging
  sendMessage(roomId: string, content: string, messageType: 'text' | 'file' = 'text'): void {
    if (this.socket) {
      this.socket.emit('send_message', { roomId, content, messageType });
    }
  }

  markMessagesAsRead(roomId: string, messageIds: string[]): void {
    if (this.socket) {
      this.socket.emit('mark_read', { roomId, messageIds });
    }
  }

  // Typing Indicators
  startTyping(roomId: string): void {
    if (this.socket) {
      this.socket.emit('typing_start', roomId);
    }
  }

  stopTyping(roomId: string): void {
    if (this.socket) {
      this.socket.emit('typing_stop', roomId);
    }
  }

  // Agent Actions
  takeChat(roomId: string): void {
    if (this.socket) {
      this.socket.emit('agent_take_chat', roomId);
    }
  }

  transferChat(roomId: string, targetAgentId?: string, reason: string = 'Transfer requested'): void {
    if (this.socket) {
      this.socket.emit('agent_transfer_chat', { roomId, targetAgentId, reason });
    }
  }

  closeChat(roomId: string, reason?: string, satisfaction?: number): void {
    if (this.socket) {
      this.socket.emit('close_chat', { roomId, reason, satisfaction });
    }
  }

  // Event Listeners
  onMessageReceived(callback: (message: ChatMessage) => void): void {
    if (this.socket) {
      this.socket.on('message_received', callback);
    }
  }

  onTypingIndicator(callback: (data: TypingIndicator) => void): void {
    if (this.socket) {
      this.socket.on('typing_indicator', callback);
    }
  }

  onChatAssigned(callback: (data: { roomId: string; agentId: string; agentName: string }) => void): void {
    if (this.socket) {
      this.socket.on('chat_assigned', callback);
    }
  }

  onChatTransferred(callback: (data: { roomId: string; fromAgent: string; toAgent: string; reason: string }) => void): void {
    if (this.socket) {
      this.socket.on('chat_transferred', callback);
    }
  }

  onChatClosed(callback: (data: { roomId: string; closedBy: string; reason?: string }) => void): void {
    if (this.socket) {
      this.socket.on('chat_closed', callback);
    }
  }

  onUserJoined(callback: (data: { roomId: string; userId: string; userName: string }) => void): void {
    if (this.socket) {
      this.socket.on('user_joined', callback);
    }
  }

  onUserLeft(callback: (data: { roomId: string; userId: string; userName: string }) => void): void {
    if (this.socket) {
      this.socket.on('user_left', callback);
    }
  }

  onAgentStatusUpdate(callback: (data: { agentId: string; status: 'online' | 'busy' | 'offline' }) => void): void {
    if (this.socket) {
      this.socket.on('agent_status_update', callback);
    }
  }

  onError(callback: (error: { message: string; code?: string }) => void): void {
    if (this.socket) {
      this.socket.on('error', callback);
    }
  }

  // Remove Event Listeners
  removeAllListeners(): void {
    if (this.socket) {
      this.socket.removeAllListeners();
    }
  }

  removeListener(event: string, callback: Function): void {
    if (this.socket) {
      this.socket.off(event, callback);
    }
  }
}

// Export singleton instance
export const socketService = new SocketService();
export type { ChatMessage, TypingIndicator, ChatRoom };