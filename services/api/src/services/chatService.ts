import { Server, Socket } from 'socket.io';
import { prisma } from '../lib/prisma';
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
            // relatedTo was a nested { type, id }; it is two columns now.
            const chatMessage = await prisma.chatMessage.create({
              data: {
                conversationId: data.conversationId,
                senderId: data.senderId,
                senderType: data.senderType as any,
                recipientId: data.recipientId,
                recipientType: data.recipientType as any,
                message: data.message,
                messageType: 'text',
                attachments: (data.attachments || []) as any,
                relatedToType: (data.relatedTo?.type as any) ?? null,
                relatedToId: data.relatedTo?.id ?? null,
                metadata: {
                  ipAddress: socket.handshake.address,
                  userAgent: socket.handshake.headers['user-agent'],
                },
              }
            });

            // Emit message to conversation room
            io.to(`conversation:${data.conversationId}`).emit('message:new', {
              ...chatMessage,
              _id: chatMessage.id,
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
            const message = await prisma.chatMessage.update({
              where: { id: data.messageId },
              data: { isRead: true, readAt: new Date() }
            });

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
      // populate() is gone - users are still Mongo documents - so the two
      // people on each message are fetched in one lookup and attached.
      const messages = await prisma.chatMessage.findMany({
        where: { conversationId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip
      });

      const { User } = require('../models/User');
      const ids = Array.from(new Set(
        messages.flatMap(m => [m.senderId, m.recipientId]).filter(Boolean) as string[]
      ));
      const people = ids.length
        ? await User.find({ _id: { $in: ids } }).select('name avatar').lean()
        : [];
      const byId = new Map(people.map((u: any) => [u._id.toString(), u]));

      return messages
        .map(m => ({
          ...m,
          _id: m.id,
          senderId: byId.get(m.senderId) ?? m.senderId,
          recipientId: m.recipientId ? byId.get(m.recipientId) ?? m.recipientId : null
        }))
        .reverse(); // Return in chronological order
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
      // The old pipeline grouped by conversationId, kept the newest message and
      // counted the unread ones addressed to this user. groupBy cannot express a
      // conditional sum or carry a whole document, so it is three steps: the
      // conversations this user is in, their newest message each, and the unread
      // counts - joined here.
      const mine = await prisma.chatMessage.findMany({
        where: { OR: [{ senderId: userId }, { recipientId: userId }] },
        select: { conversationId: true },
        distinct: ['conversationId']
      });
      const conversationIds = mine.map(m => m.conversationId);
      if (conversationIds.length === 0) return [];

      const [newest, unread] = await Promise.all([
        prisma.chatMessage.findMany({
          where: { conversationId: { in: conversationIds } },
          orderBy: { createdAt: 'desc' },
          distinct: ['conversationId']
        }),
        prisma.chatMessage.groupBy({
          by: ['conversationId'],
          where: {
            conversationId: { in: conversationIds },
            recipientId: userId,
            isRead: false
          },
          _count: { conversationId: true }
        })
      ]);

      const unreadByConversation = new Map(
        unread.map(u => [u.conversationId, u._count.conversationId])
      );

      return newest
        .map(lastMessage => ({
          _id: lastMessage.conversationId,
          lastMessage: { ...lastMessage, _id: lastMessage.id },
          unreadCount: unreadByConversation.get(lastMessage.conversationId) ?? 0
        }))
        .sort((a, b) =>
          b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime());
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
