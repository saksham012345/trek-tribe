import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { RealTimeChat } from '../models/RealTimeChat';
import { Query } from '../models/Query';
import { emailService } from '../services/emailService';
import mongoose from 'mongoose';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  userRole?: string;
  userName?: string;
}

interface SocketUser {
  userId: string;
  userRole: string;
  userName: string;
  socketId: string;
  isOnline: boolean;
  lastSeen: Date;
}

class ChatServer {
  private io: SocketIOServer;
  private onlineUsers: Map<string, SocketUser> = new Map();
  private userSockets: Map<string, string> = new Map(); // userId -> socketId

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? [
              'https://trek-tribe-web.vercel.app',
              'https://trek-tribe-web-saksham-s-projects-76ba6bcc.vercel.app',
              process.env.FRONTEND_URL || 'http://localhost:3000'
            ]
          : ['http://localhost:3000'],
        credentials: true
      },
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket: AuthenticatedSocket, next) => {
      try {
        const token = socket.handshake.auth.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
        const user = await User.findById(decoded.userId).select('-passwordHash');
        
        if (!user || !user.isActive) {
          return next(new Error('Invalid or inactive user'));
        }

        socket.userId = (user._id as mongoose.Types.ObjectId).toString();
        socket.userRole = user.role;
        socket.userName = user.name;

        next();
      } catch (error) {
        next(new Error('Authentication failed'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthenticatedSocket) => {
      console.log(`👤 User ${socket.userName} (${socket.userRole}) connected: ${socket.id}`);
      
      // Add user to online users
      this.addOnlineUser(socket);
      
      // Join user to their personal room
      socket.join(`user:${socket.userId}`);
      
      // Join agents/admins to agent room for notifications
      if (socket.userRole === 'agent' || socket.userRole === 'admin') {
        socket.join('agents');
      }

      // Handle joining chat rooms
      socket.on('join_chat', async (data: { roomId: string }) => {
        try {
          const chat = await RealTimeChat.findOne({ roomId: data.roomId });
          
          if (!chat) {
            socket.emit('error', { message: 'Chat room not found' });
            return;
          }

          // Check if user has permission to join
          const canJoin = chat.userId.toString() === socket.userId || 
                         socket.userRole === 'agent' || 
                         socket.userRole === 'admin' ||
                         chat.assignedAgentId?.toString() === socket.userId;

          if (!canJoin) {
            socket.emit('error', { message: 'Access denied to this chat room' });
            return;
          }

          socket.join(data.roomId);
          
          // Update participant status
          await this.updateParticipantStatus(data.roomId, socket.userId!, true);
          
          // Send chat history
          const chatHistory = await RealTimeChat.findOne({ roomId: data.roomId })
            .populate('messages.senderId', 'name role')
            .populate('assignedAgentId', 'name email');
            
          socket.emit('chat_history', {
            roomId: data.roomId,
            messages: chatHistory?.messages || [],
            participants: chatHistory?.participants || [],
            status: chatHistory?.status || 'pending'
          });

          console.log(`📱 ${socket.userName} joined chat room: ${data.roomId}`);
          
        } catch (error) {
          console.error('Error joining chat:', error);
          socket.emit('error', { message: 'Failed to join chat room' });
        }
      });

      // Handle sending messages
      socket.on('send_message', async (data: {
        roomId: string;
        content: string;
        type?: 'text' | 'image' | 'file' | 'location';
        metadata?: any;
      }) => {
        try {
          const chat = await RealTimeChat.findOne({ roomId: data.roomId });
          
          if (!chat) {
            socket.emit('error', { message: 'Chat room not found' });
            return;
          }

          const messageId = new mongoose.Types.ObjectId().toString();
          const newMessage = {
            messageId,
            senderId: new mongoose.Types.ObjectId(socket.userId!),
            senderRole: socket.userRole as any,
            type: data.type || 'text',
            content: data.content,
            metadata: data.metadata,
            timestamp: new Date(),
            readBy: []
          };

          // Add message to chat
          chat.messages.push(newMessage);
          
          // Update first response time if this is agent's first message
          if ((socket.userRole === 'agent' || socket.userRole === 'admin') && !chat.firstResponseAt) {
            chat.firstResponseAt = new Date();
          }

          await chat.save();

          // Prepare message for broadcast
          const messageForBroadcast = {
            ...newMessage,
            senderId: {
              _id: socket.userId,
              name: socket.userName,
              role: socket.userRole
            }
          };

          // Broadcast to all participants in the room
          this.io.to(data.roomId).emit('new_message', {
            roomId: data.roomId,
            message: messageForBroadcast
          });

          // Notify agents if user sent message and no agent is assigned
          if (socket.userRole === 'traveler' && !chat.assignedAgentId) {
            this.io.to('agents').emit('new_unassigned_message', {
              roomId: data.roomId,
              userName: socket.userName,
              preview: data.content.substring(0, 100),
              priority: chat.priority
            });
          }

          console.log(`💬 Message sent in ${data.roomId} by ${socket.userName}`);
          
        } catch (error) {
          console.error('Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle agent assignment
      socket.on('assign_to_me', async (data: { roomId: string }) => {
        try {
          if (socket.userRole !== 'agent' && socket.userRole !== 'admin') {
            socket.emit('error', { message: 'Only agents can assign chats' });
            return;
          }

          const chat = await RealTimeChat.findOneAndUpdate(
            { roomId: data.roomId, assignedAgentId: { $exists: false } },
            {
              assignedAgentId: new mongoose.Types.ObjectId(socket.userId!),
              status: 'active',
              $push: {
                participants: {
                  userId: new mongoose.Types.ObjectId(socket.userId!),
                  role: socket.userRole,
                  joinedAt: new Date(),
                  isOnline: true
                },
                messages: {
                  messageId: new mongoose.Types.ObjectId().toString(),
                  senderId: new mongoose.Types.ObjectId(socket.userId!),
                  senderRole: socket.userRole,
                  type: 'system',
                  content: `${socket.userName} has joined the conversation`,
                  timestamp: new Date(),
                  readBy: []
                }
              }
            },
            { new: true }
          );

          if (!chat) {
            socket.emit('error', { message: 'Chat already assigned or not found' });
            return;
          }

          // Join the agent to the room
          socket.join(data.roomId);

          // Notify all participants
          this.io.to(data.roomId).emit('agent_assigned', {
            roomId: data.roomId,
            agentName: socket.userName,
            agentId: socket.userId
          });

          // Remove from unassigned notifications
          this.io.to('agents').emit('chat_assigned', {
            roomId: data.roomId,
            assignedTo: socket.userName
          });

          // Send email notification to user about agent assignment
          try {
            await emailService.sendAgentAssignedNotification(
              chat.userId.toString(),
              socket.userId!,
              {
                roomId: data.roomId,
                subject: chat.subject || 'Support Chat'
              }
            );
          } catch (emailError) {
            console.error('Failed to send agent assignment email:', emailError);
          }

          console.log(`👨‍💼 ${socket.userName} assigned to chat: ${data.roomId}`);
          
        } catch (error) {
          console.error('Error assigning chat:', error);
          socket.emit('error', { message: 'Failed to assign chat' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data: { roomId: string }) => {
        socket.to(data.roomId).emit('user_typing', {
          roomId: data.roomId,
          userName: socket.userName,
          userId: socket.userId
        });
      });

      socket.on('typing_stop', (data: { roomId: string }) => {
        socket.to(data.roomId).emit('user_stopped_typing', {
          roomId: data.roomId,
          userId: socket.userId
        });
      });

      // Handle message read receipts
      socket.on('mark_as_read', async (data: { roomId: string, messageIds: string[] }) => {
        try {
          await RealTimeChat.updateOne(
            { roomId: data.roomId },
            {
              $push: {
                'messages.$[elem].readBy': {
                  userId: new mongoose.Types.ObjectId(socket.userId!),
                  readAt: new Date()
                }
              }
            },
            {
              arrayFilters: [{ 'elem.messageId': { $in: data.messageIds } }]
            }
          );

          socket.to(data.roomId).emit('messages_read', {
            roomId: data.roomId,
            messageIds: data.messageIds,
            readBy: socket.userId
          });
          
        } catch (error) {
          console.error('Error marking messages as read:', error);
        }
      });

      // Handle chat closure
      socket.on('close_chat', async (data: { 
        roomId: string, 
        reason?: string,
        satisfaction?: { rating: number, feedback?: string }
      }) => {
        try {
          const updateData: any = {
            status: 'closed',
            chatClosedAt: new Date(),
            closedBy: new mongoose.Types.ObjectId(socket.userId!)
          };

          if (data.reason) {
            updateData.closureReason = data.reason;
          }

          if (data.satisfaction) {
            updateData.satisfaction = {
              ...data.satisfaction,
              submittedAt: new Date()
            };
          }

          // Calculate chat duration
          const chat = await RealTimeChat.findOne({ roomId: data.roomId });
          if (chat) {
            updateData.chatDuration = Math.floor(
              (new Date().getTime() - chat.chatStartedAt.getTime()) / 1000
            );
          }

          await RealTimeChat.updateOne({ roomId: data.roomId }, updateData);

          // Notify all participants
          this.io.to(data.roomId).emit('chat_closed', {
            roomId: data.roomId,
            closedBy: socket.userName,
            reason: data.reason
          });

          // Send email notification to user about chat closure
          if (chat) {
            try {
              await emailService.sendChatClosedNotification(
                chat.userId.toString(),
                {
                  roomId: data.roomId,
                  subject: chat.subject || 'Support Chat',
                  closedBy: socket.userName,
                  reason: data.reason,
                  duration: updateData.chatDuration ? `${Math.floor(updateData.chatDuration / 60)} minutes` : null,
                  satisfaction: data.satisfaction
                }
              );
            } catch (emailError) {
              console.error('Failed to send chat closed email:', emailError);
            }
          }

          console.log(`❌ Chat ${data.roomId} closed by ${socket.userName}`);
          
        } catch (error) {
          console.error('Error closing chat:', error);
          socket.emit('error', { message: 'Failed to close chat' });
        }
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`👋 User ${socket.userName} disconnected: ${socket.id}`);
        this.removeOnlineUser(socket.userId!);
        this.updateUserOfflineStatus(socket.userId!);
      });

      // Handle errors
      socket.on('error', (error) => {
        console.error(`❌ Socket error for ${socket.userName}:`, error);
      });
    });
  }

  private addOnlineUser(socket: AuthenticatedSocket) {
    const userInfo: SocketUser = {
      userId: socket.userId!,
      userRole: socket.userRole!,
      userName: socket.userName!,
      socketId: socket.id,
      isOnline: true,
      lastSeen: new Date()
    };

    this.onlineUsers.set(socket.userId!, userInfo);
    this.userSockets.set(socket.userId!, socket.id);

    // Broadcast online status to relevant users
    socket.broadcast.emit('user_online', {
      userId: socket.userId,
      userName: socket.userName
    });
  }

  private removeOnlineUser(userId: string) {
    this.onlineUsers.delete(userId);
    this.userSockets.delete(userId);
  }

  private async updateUserOfflineStatus(userId: string) {
    try {
      // Update all chats where this user is a participant
      await RealTimeChat.updateMany(
        { 'participants.userId': new mongoose.Types.ObjectId(userId) },
        {
          $set: {
            'participants.$.isOnline': false,
            'participants.$.lastSeen': new Date()
          }
        }
      );
    } catch (error) {
      console.error('Error updating offline status:', error);
    }
  }

  private async updateParticipantStatus(roomId: string, userId: string, isOnline: boolean) {
    try {
      await RealTimeChat.updateOne(
        { roomId, 'participants.userId': new mongoose.Types.ObjectId(userId) },
        {
          $set: {
            'participants.$.isOnline': isOnline,
            'participants.$.lastSeen': new Date()
          }
        }
      );
    } catch (error) {
      console.error('Error updating participant status:', error);
    }
  }

  // Public methods for external use
  public async transferChatFromBot(userId: string, queryId: string, reason: string): Promise<string> {
    try {
      const roomId = `chat_${userId}_${Date.now()}`;
      
      const chat = new RealTimeChat({
        roomId,
        userId: new mongoose.Types.ObjectId(userId),
        relatedQueryId: new mongoose.Types.ObjectId(queryId),
        status: 'pending',
        priority: 'medium',
        isTransferredFromBot: true,
        transferReason: reason,
        participants: [{
          userId: new mongoose.Types.ObjectId(userId),
          role: 'user',
          joinedAt: new Date(),
          isOnline: this.onlineUsers.has(userId)
        }],
        messages: [{
          messageId: new mongoose.Types.ObjectId().toString(),
          senderId: new mongoose.Types.ObjectId(userId),
          senderRole: 'user',
          type: 'system',
          content: `Chat transferred from AI assistant. Reason: ${reason}`,
          timestamp: new Date(),
          readBy: []
        }]
      });

      await chat.save();

      // Notify agents
      this.io.to('agents').emit('new_chat_from_bot', {
        roomId,
        userId,
        reason,
        priority: 'medium'
      });

      // Notify the user
      this.io.to(`user:${userId}`).emit('chat_transferred', {
        roomId,
        message: 'Your chat has been transferred to a human agent. Please wait for assistance.'
      });

      return roomId;
    } catch (error) {
      console.error('Error transferring chat from bot:', error);
      throw error;
    }
  }

  public getOnlineUsers(): SocketUser[] {
    return Array.from(this.onlineUsers.values());
  }

  public isUserOnline(userId: string): boolean {
    return this.onlineUsers.has(userId);
  }

  public async notifyUser(userId: string, notification: any) {
    this.io.to(`user:${userId}`).emit('notification', notification);
  }

  public async notifyAgents(notification: any) {
    this.io.to('agents').emit('agent_notification', notification);
  }
}

export default ChatServer;