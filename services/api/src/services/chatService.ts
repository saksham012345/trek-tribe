import { Server, Socket } from 'socket.io';
import ChatMessage from '../models/ChatMessage';
import notificationService from './notificationService';

class ChatService {
  private io: Server | null = null;
  private onlineUsers: Map<string, string> = new Map(); // userId -> socketId

  /**
   * Initialize Socket.IO
   */
  initializeSocketIO(io: Server) {
    this.io = io;

    io.on('connection', (socket: Socket) => {
      console.log('User connected:', socket.id);

      // Handle user authentication
      socket.on('authenticate', (data: { userId: string; userType: string }) => {
        this.onlineUsers.set(data.userId, socket.id);
        socket.data.userId = data.userId;
        socket.data.userType = data.userType;

        // Join user's personal room
        socket.join(`user:${data.userId}`);

        // Notify user came online
        io.emit('user:online', { userId: data.userId });

        console.log(`User ${data.userId} authenticated as ${data.userType}`);
      });

      // Handle joining conversation
      socket.on('join:conversation', (conversationId: string) => {
        socket.join(`conversation:${conversationId}`);
        console.log(`User joined conversation: ${conversationId}`);
      });

      // Handle leaving conversation
      socket.on('leave:conversation', (conversationId: string) => {
        socket.leave(`conversation:${conversationId}`);
        console.log(`User left conversation: ${conversationId}`);
      });

      // Handle new message
      socket.on(
        'message:send',
        async (data: {
          conversationId: string;
          senderId: string;
          senderType: string;
          recipientId?: string;
          recipientType?: string;
          message: string;
          attachments?: any[];
          relatedTo?: { type: string; id: string };
        }) => {
          try {
            // Save message to database
            const chatMessage = new ChatMessage({
              conversationId: data.conversationId,
              senderId: data.senderId,
              senderType: data.senderType,
              recipientId: data.recipientId,
              recipientType: data.recipientType,
              message: data.message,
              messageType: 'text',
              attachments: data.attachments || [],
              relatedTo: data.relatedTo,
              metadata: {
                ipAddress: socket.handshake.address,
                userAgent: socket.handshake.headers['user-agent'],
              },
            });

            await chatMessage.save();

            // Emit message to conversation room
            io.to(`conversation:${data.conversationId}`).emit('message:new', {
              ...chatMessage.toObject(),
              timestamp: new Date(),
            });

            // Send notification to recipient if not online
            if (data.recipientId) {
              const recipientOnline = this.onlineUsers.has(data.recipientId);

              if (!recipientOnline) {
                await notificationService.createNotification({
                  userId: data.recipientId,
                  type: 'chat',
                  title: 'New Chat Message',
                  message: `You have a new message`,
                  actionUrl: `/chat/${data.conversationId}`,
                  actionType: 'respond_chat',
                  relatedTo: { type: 'chat', id: data.conversationId as any },
                  sendEmail: true,
                });
              }
            }

            console.log('Message sent successfully');
          } catch (error) {
            console.error('Error sending message:', error);
            socket.emit('message:error', {
              error: 'Failed to send message',
            });
          }
        }
      );

      // Handle typing indicator
      socket.on(
        'typing:start',
        (data: { conversationId: string; userId: string; userName: string }) => {
          socket.to(`conversation:${data.conversationId}`).emit('typing:indicator', {
            userId: data.userId,
            userName: data.userName,
            isTyping: true,
          });
        }
      );

      socket.on('typing:stop', (data: { conversationId: string; userId: string }) => {
        socket.to(`conversation:${data.conversationId}`).emit('typing:indicator', {
          userId: data.userId,
          isTyping: false,
        });
      });

      // Handle message read receipt
      socket.on(
        'message:read',
        async (data: { conversationId: string; messageId: string }) => {
          try {
            const message = await ChatMessage.findByIdAndUpdate(
              data.messageId,
              {
                isRead: true,
                readAt: new Date(),
              },
              { new: true }
            );

            if (message) {
              io.to(`conversation:${data.conversationId}`).emit('message:read', {
                messageId: data.messageId,
                readAt: message.readAt,
              });
            }
          } catch (error) {
            console.error('Error marking message as read:', error);
          }
        }
      );

      // Handle disconnection
      socket.on('disconnect', () => {
        if (socket.data.userId) {
          this.onlineUsers.delete(socket.data.userId);
          io.emit('user:offline', { userId: socket.data.userId });
          console.log(`User ${socket.data.userId} disconnected`);
        }
      });
    });
  }

  /**
   * Get conversation messages
   */
  async getConversationMessages(conversationId: string, limit: number = 50, skip: number = 0) {
    try {
      const messages = await ChatMessage.find({ conversationId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip(skip)
        .populate('senderId', 'name avatar')
        .populate('recipientId', 'name avatar');

      return messages.reverse(); // Return in chronological order
    } catch (error) {
      console.error('Error fetching messages:', error);
      throw error;
    }
  }

  /**
   * Create a new conversation
   */
  createConversationId(userId1: string, userId2: string): string {
    // Create deterministic conversation ID
    const ids = [userId1, userId2].sort();
    return `conv_${ids[0]}_${ids[1]}`;
  }

  /**
   * Get user's conversations
   */
  async getUserConversations(userId: string) {
    try {
      const conversations = await ChatMessage.aggregate([
        {
          $match: {
            $or: [{ senderId: userId }, { recipientId: userId }],
          },
        },
        {
          $sort: { createdAt: -1 },
        },
        {
          $group: {
            _id: '$conversationId',
            lastMessage: { $first: '$$ROOT' },
            unreadCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $eq: ['$recipientId', userId] },
                      { $eq: ['$isRead', false] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $sort: { 'lastMessage.createdAt': -1 },
        },
      ]);

      return conversations;
    } catch (error) {
      console.error('Error fetching conversations:', error);
      throw error;
    }
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  /**
   * Get all online users
   */
  getOnlineUsers(): string[] {
    return Array.from(this.onlineUsers.keys());
  }
}

export default new ChatService();
