import { Server as SocketIOServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { aiSupportService } from './aiSupportService';
import { SupportTicket } from '../models/SupportTicket';
import { User } from '../models/User';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'agent' | 'ai';
  message: string;
  timestamp: Date;
  ticketId?: string;
}

interface ActiveChatSession {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  isConnectedToAgent: boolean;
  agentId?: string;
  agentName?: string;
  ticketId?: string;
  messages: ChatMessage[];
  createdAt: Date;
  lastActivity: Date;
}

class SocketService {
  private io: SocketIOServer | null = null;
  private activeSessions = new Map<string, ActiveChatSession>();
  private userSocketMap = new Map<string, string>(); // userId -> socketId
  private agentSocketMap = new Map<string, string>(); // agentId -> socketId
  private sessionCleanupInterval: NodeJS.Timeout | null = null;

  initialize(server: HttpServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.SOCKET_ORIGIN || process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/socket.io/'
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          // Allow guest users for basic support
          socket.data.isGuest = true;
          socket.data.guestId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          return next();
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        const user = await User.findById(decoded.id);
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.data.userId = (user._id as any).toString();
        socket.data.userRole = user.role;
        socket.data.userName = user.name;
        socket.data.userEmail = user.email;
        socket.data.isGuest = false;

        next();
      } catch (error) {
        logger.error('Socket authentication error', { error: error });
        next(new Error('Authentication failed'));
      }
    });

    this.setupEventHandlers();
    this.setupCleanupInterval();
    
    logger.info('Socket.IO service initialized');
  }

  private setupEventHandlers() {
    if (!this.io) return;

    this.io.on('connection', (socket) => {
      const userId = socket.data.isGuest ? socket.data.guestId : socket.data.userId;
      const userRole = socket.data.userRole || 'guest';
      
      logger.info('User connected to chat', { 
        userId, 
        socketId: socket.id, 
        role: userRole,
        isGuest: socket.data.isGuest 
      });

      // Map user to socket for direct messaging and join user-specific room
      if (!socket.data.isGuest) {
        this.userSocketMap.set(userId, socket.id);
        socket.join(`user_${userId}`);
        
        // Map agents separately for routing and join agent room
        if (userRole === 'agent' || userRole === 'admin') {
          this.agentSocketMap.set(userId, socket.id);
          socket.join('agent_room');
        }
      }

      // Handle chat initialization
      socket.on('init_chat', async (data) => {
        await this.handleChatInit(socket, data);
      });

      // Handle AI chat messages
      socket.on('ai_chat_message', async (data) => {
        await this.handleAIChatMessage(socket, data);
      });

      // Handle human agent transfer request
      socket.on('request_human_agent', async (data) => {
        await this.handleHumanAgentRequest(socket, data);
      });

      // Handle agent joining chat
      socket.on('agent_join_chat', async (data) => {
        await this.handleAgentJoinChat(socket, data);
      });

      // Handle agent chat messages
      socket.on('agent_chat_message', async (data) => {
        await this.handleAgentChatMessage(socket, data);
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        this.handleTypingStart(socket, data);
      });

      socket.on('typing_stop', (data) => {
        this.handleTypingStop(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
    });
  }

  private async handleChatInit(socket: any, data: any) {
    const userId = socket.data.isGuest ? socket.data.guestId : socket.data.userId;
    const sessionId = `session_${userId}_${Date.now()}`;

    const session: ActiveChatSession = {
      sessionId,
      userId,
      userName: socket.data.userName || `Guest User`,
      userEmail: socket.data.userEmail || 'guest@example.com',
      isConnectedToAgent: false,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };

    this.activeSessions.set(sessionId, session);
    
    socket.join(sessionId);
    socket.data.sessionId = sessionId;

    // Send welcome message
    const welcomeMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: 'ai',
      senderName: 'Trek Tribe Assistant',
      senderRole: 'ai',
      message: "Hi! I'm your Trek Tribe assistant. I can help you with questions about trips, bookings, and using our platform. How can I assist you today?",
      timestamp: new Date()
    };

    session.messages.push(welcomeMessage);
    
    socket.emit('chat_initialized', {
      sessionId,
      message: welcomeMessage
    });

    logger.info('Chat session initialized', { sessionId, userId });
  }

  private async handleAIChatMessage(socket: any, data: { message: string, context?: any }) {
    const sessionId = socket.data.sessionId;
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      socket.emit('error', { message: 'Chat session not found' });
      return;
    }

    try {
      // Add user message to session
      const userMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        senderId: session.userId,
        senderName: session.userName,
        senderRole: 'user',
        message: data.message,
        timestamp: new Date()
      };

      session.messages.push(userMessage);
      session.lastActivity = new Date();

      // Build context from session history
      const chatContext = {
        userId: socket.data.isGuest ? undefined : session.userId,
        userRole: socket.data.userRole,
        tripId: data.context?.tripId,
        previousMessages: session.messages.slice(-10).map(msg => ({
          role: msg.senderRole === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.message,
          timestamp: msg.timestamp
        }))
      };

      // Get AI response
      const aiResponse = await aiSupportService.handleUserQuery(data.message, chatContext);

      const aiMessage: ChatMessage = {
        id: `msg_${Date.now() + 1}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: aiResponse.message,
        timestamp: new Date()
      };

      session.messages.push(aiMessage);

      // Send messages to user
      socket.emit('chat_message', userMessage);
      socket.emit('chat_message', aiMessage);

      // If AI suggests human support, offer the option
      if (aiResponse.requiresHumanSupport) {
        socket.emit('human_support_suggested', {
          confidence: aiResponse.confidence,
          suggestedActions: aiResponse.suggestedActions
        });
      }

      logger.info('AI chat message processed', { 
        sessionId, 
        requiresHuman: aiResponse.requiresHumanSupport,
        confidence: aiResponse.confidence
      });

    } catch (error: any) {
      logger.error('Error processing AI chat message', { 
        error: error.message, 
        sessionId 
      });
      
      socket.emit('error', { 
        message: 'Sorry, I encountered an error. Please try again or request human support.' 
      });
    }
  }

  private async handleHumanAgentRequest(socket: any, data: { reason?: string, urgency?: 'low' | 'medium' | 'high' }) {
    const sessionId = socket.data.sessionId;
    const session = this.activeSessions.get(sessionId);
    
    if (!session) {
      socket.emit('error', { message: 'Chat session not found' });
      return;
    }

    try {
      // Create support ticket if user is authenticated
      let ticketId: string | undefined;
      
      if (!socket.data.isGuest) {
        const ticketSubject = `Chat Support Request - ${data.reason || 'General Inquiry'}`;
        const ticketDescription = `User requested human support during chat session.\n\nReason: ${data.reason || 'Not specified'}\n\nChat History:\n${session.messages.map(msg => `${msg.senderName}: ${msg.message}`).join('\n')}`;
        
        // Create ticket directly using SupportTicket model
        const newTicket = await SupportTicket.create({
          userId: session.userId,
          subject: ticketSubject,
          description: ticketDescription,
          category: 'general',
          priority: data.urgency === 'high' ? 'high' : data.urgency === 'low' ? 'low' : 'medium',
          customerEmail: session.userEmail,
          customerName: session.userName,
          status: 'open',
          messages: [{
            sender: 'customer',
            senderName: session.userName,
            senderId: session.userId,
            message: ticketDescription,
            timestamp: new Date()
          }]
        });

        ticketId = newTicket.ticketId;
        session.ticketId = ticketId;

        // Notify agents about the new ticket
        this.notifyNewTicket({
          ticketId: newTicket.ticketId,
          userId: session.userId,
          customerName: session.userName,
          customerEmail: session.userEmail,
          subject: ticketSubject,
          priority: newTicket.priority,
          category: newTicket.category,
          chatSessionId: sessionId,
          createdAt: newTicket.createdAt
        });
      }

      // Notify available agents
      this.notifyAvailableAgents(session, data.urgency || 'medium');

      // Update session status
      session.lastActivity = new Date();

      const systemMessage: ChatMessage = {
        id: `msg_${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'ai',
        message: "I'm connecting you with a human support agent. Please wait a moment while I find someone to help you.",
        timestamp: new Date(),
        ticketId
      };

      session.messages.push(systemMessage);
      socket.emit('chat_message', systemMessage);
      socket.emit('agent_request_sent', { ticketId });

      logger.info('Human agent requested', { 
        sessionId, 
        ticketId, 
        urgency: data.urgency 
      });

    } catch (error: any) {
      logger.error('Error requesting human agent', { 
        error: error.message, 
        sessionId 
      });
      
      socket.emit('error', { 
        message: 'Unable to connect to human support right now. Please try again later.' 
      });
    }
  }

  private async handleAgentJoinChat(socket: any, data: { sessionId: string }) {
    const agentId = socket.data.userId;
    const session = this.activeSessions.get(data.sessionId);
    
    if (!session) {
      socket.emit('error', { message: 'Chat session not found' });
      return;
    }

    if (session.isConnectedToAgent) {
      socket.emit('error', { message: 'Session already has an agent' });
      return;
    }

    // Connect agent to session
    session.isConnectedToAgent = true;
    session.agentId = agentId;
    session.agentName = socket.data.userName;
    session.lastActivity = new Date();

    socket.join(data.sessionId);

    // Notify user that agent has joined
    const userSocketId = this.userSocketMap.get(session.userId);
    if (userSocketId) {
      this.io?.to(userSocketId).emit('agent_joined', {
        agentName: session.agentName,
        message: `${session.agentName} has joined the chat and will assist you.`
      });
    }

    // Send chat history to agent
    socket.emit('chat_history', {
      session: {
        sessionId: session.sessionId,
        userName: session.userName,
        userEmail: session.userEmail,
        ticketId: session.ticketId,
        createdAt: session.createdAt
      },
      messages: session.messages
    });

    logger.info('Agent joined chat session', { 
      sessionId: data.sessionId, 
      agentId, 
      agentName: session.agentName 
    });
  }

  private async handleAgentChatMessage(socket: any, data: { sessionId: string, message: string }) {
    const session = this.activeSessions.get(data.sessionId);
    
    if (!session || !session.isConnectedToAgent || session.agentId !== socket.data.userId) {
      socket.emit('error', { message: 'Unauthorized or session not found' });
      return;
    }

    const agentMessage: ChatMessage = {
      id: `msg_${Date.now()}`,
      senderId: session.agentId!,
      senderName: session.agentName!,
      senderRole: 'agent',
      message: data.message,
      timestamp: new Date(),
      ticketId: session.ticketId
    };

    session.messages.push(agentMessage);
    session.lastActivity = new Date();

    // Send to all participants in the session
    this.io?.to(data.sessionId).emit('chat_message', agentMessage);

    // Update support ticket if it exists
    if (session.ticketId) {
      try {
        await SupportTicket.findOneAndUpdate(
          { ticketId: session.ticketId },
          {
            $push: {
              messages: {
                sender: 'agent',
                senderName: session.agentName,
                message: data.message,
                timestamp: new Date()
              }
            },
            $set: {
              status: 'in_progress',
              assignedTo: session.agentId,
              updatedAt: new Date()
            }
          }
        );
      } catch (error: any) {
        logger.error('Error updating support ticket', { 
          error: error.message, 
          ticketId: session.ticketId 
        });
      }
    }

    logger.info('Agent chat message sent', { 
      sessionId: data.sessionId, 
      agentId: session.agentId 
    });
  }

  private handleTypingStart(socket: any, data: { sessionId: string }) {
    const session = this.activeSessions.get(data.sessionId);
    if (!session) return;

    socket.to(data.sessionId).emit('typing_start', {
      userId: socket.data.userId || socket.data.guestId,
      userName: socket.data.userName || 'Guest User'
    });
  }

  private handleTypingStop(socket: any, data: { sessionId: string }) {
    const session = this.activeSessions.get(data.sessionId);
    if (!session) return;

    socket.to(data.sessionId).emit('typing_stop', {
      userId: socket.data.userId || socket.data.guestId
    });
  }

  private handleDisconnect(socket: any) {
    const userId = socket.data.isGuest ? socket.data.guestId : socket.data.userId;
    
    logger.info('User disconnected from chat', { 
      userId, 
      socketId: socket.id,
      isGuest: socket.data.isGuest
    });

    if (!socket.data.isGuest) {
      this.userSocketMap.delete(userId);
      
      if (socket.data.userRole === 'agent' || socket.data.userRole === 'admin') {
        this.agentSocketMap.delete(userId);
      }
    }

    // Mark session as inactive but don't delete immediately
    const sessionId = socket.data.sessionId;
    if (sessionId) {
      const session = this.activeSessions.get(sessionId);
      if (session) {
        session.lastActivity = new Date();
      }
    }
  }

  private notifyAvailableAgents(session: ActiveChatSession, urgency: 'low' | 'medium' | 'high') {
    const agentNotification = {
      type: 'new_chat_request',
      sessionId: session.sessionId,
      userName: session.userName,
      userEmail: session.userEmail,
      urgency,
      ticketId: session.ticketId,
      messagePreview: session.messages.slice(-3).map(m => m.message).join(' | '),
      createdAt: session.createdAt
    };

    // Notify all connected agents
    this.agentSocketMap.forEach((socketId, agentId) => {
      this.io?.to(socketId).emit('chat_request', agentNotification);
    });

    logger.info('Notified agents of new chat request', { 
      sessionId: session.sessionId, 
      agentCount: this.agentSocketMap.size 
    });
  }

  private setupCleanupInterval() {
    // Clean up inactive sessions every 30 minutes
    this.sessionCleanupInterval = setInterval(() => {
      const now = new Date();
      const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);

      this.activeSessions.forEach((session, sessionId) => {
        if (session.lastActivity < thirtyMinutesAgo) {
          this.activeSessions.delete(sessionId);
          logger.info('Cleaned up inactive chat session', { sessionId });
        }
      });
    }, 30 * 60 * 1000); // 30 minutes
  }

  getActiveSessionsCount(): number {
    return this.activeSessions.size;
  }

  getConnectedUsersCount(): number {
    return this.userSocketMap.size;
  }

  getConnectedAgentsCount(): number {
    return this.agentSocketMap.size;
  }

  // Real-time dashboard updates
  broadcastTripUpdate(tripData: any, eventType: 'created' | 'updated' | 'deleted' | 'joined' | 'payment_verified') {
    if (!this.io) return;

    // Broadcast to all connected users
    this.io.emit('trip_update', {
      type: eventType,
      trip: tripData,
      timestamp: new Date()
    });

    // Specific notifications for organizers
    if (tripData.organizerId) {
      const organizerSocketId = this.userSocketMap.get(tripData.organizerId.toString());
      if (organizerSocketId) {
        this.io.to(organizerSocketId).emit('organizer_notification', {
          type: eventType,
          message: this.getTripUpdateMessage(eventType, tripData),
          trip: tripData,
          timestamp: new Date()
        });
      }
    }

    logger.info('Trip update broadcasted', { tripId: tripData._id, eventType });
  }

  broadcastBookingUpdate(bookingData: any, eventType: 'created' | 'updated' | 'payment_verified' | 'cancelled') {
    if (!this.io) return;

    // Notify the specific organizer
    if (bookingData.organizerId) {
      const organizerSocketId = this.userSocketMap.get(bookingData.organizerId.toString());
      if (organizerSocketId) {
        this.io.to(organizerSocketId).emit('booking_update', {
          type: eventType,
          booking: bookingData,
          message: this.getBookingUpdateMessage(eventType, bookingData),
          timestamp: new Date()
        });
      }
    }

    // Notify the traveler
    if (bookingData.userId) {
      const userSocketId = this.userSocketMap.get(bookingData.userId.toString());
      if (userSocketId) {
        this.io.to(userSocketId).emit('user_booking_update', {
          type: eventType,
          booking: bookingData,
          message: this.getBookingUserMessage(eventType, bookingData),
          timestamp: new Date()
        });
      }
    }

    // Broadcast to agents for monitoring
    this.agentSocketMap.forEach((socketId) => {
      this.io?.to(socketId).emit('agent_dashboard_update', {
        type: 'booking_' + eventType,
        data: bookingData,
        timestamp: new Date()
      });
    });

    logger.info('Booking update broadcasted', { bookingId: bookingData._id, eventType });
  }

  broadcastAdminUpdate(data: any, eventType: string) {
    if (!this.io) return;

    // Notify all admins
    this.userSocketMap.forEach((socketId, userId) => {
      // You'd need to check user role from your user cache or make a quick query
      this.io?.to(socketId).emit('admin_update', {
        type: eventType,
        data,
        timestamp: new Date()
      });
    });

    logger.info('Admin update broadcasted', { eventType });
  }

  private getTripUpdateMessage(eventType: string, tripData: any): string {
    switch (eventType) {
      case 'created':
        return `New trip "${tripData.title}" has been created!`;
      case 'joined':
        return `Someone joined your trip "${tripData.title}"`;
      case 'payment_verified':
        return `Payment verified for "${tripData.title}"`;
      default:
        return `Trip "${tripData.title}" has been updated`;
    }
  }

  private getBookingUpdateMessage(eventType: string, bookingData: any): string {
    switch (eventType) {
      case 'created':
        return `New booking received for trip "${bookingData.tripTitle}"`;
      case 'payment_verified':
        return `Payment verified for booking #${bookingData.bookingId}`;
      default:
        return `Booking #${bookingData.bookingId} has been updated`;
    }
  }

  private getBookingUserMessage(eventType: string, bookingData: any): string {
    switch (eventType) {
      case 'created':
        return `Your booking for "${bookingData.tripTitle}" is pending verification`;
      case 'payment_verified':
        return `Your payment has been verified! Your booking is confirmed.`;
      case 'cancelled':
        return `Your booking has been cancelled.`;
      default:
        return `Your booking status has been updated`;
    }
  }

  // Notify agents about new tickets
  notifyNewTicket(ticketData: any) {
    if (!this.io) return;

    const ticketNotification = {
      type: 'new_ticket',
      ticketId: ticketData.ticketId,
      userId: ticketData.userId,
      customerName: ticketData.customerName,
      customerEmail: ticketData.customerEmail,
      subject: ticketData.subject,
      priority: ticketData.priority,
      category: ticketData.category,
      chatSessionId: ticketData.chatSessionId,
      createdAt: ticketData.createdAt,
      timestamp: new Date()
    };

    // Emit to all agents in agent room
    this.io.to('agent_room').emit('new_ticket', ticketNotification);
    
    logger.info('New ticket notification sent to agents', { 
      ticketId: ticketData.ticketId,
      connectedAgents: this.agentSocketMap.size 
    });
  }

  // Send agent reply to user
  sendAgentReply(userId: string, message: any) {
    if (!this.io) return;

    this.io.to(`user_${userId}`).emit('agent_reply', {
      ticketId: message.ticketId,
      agentName: message.agentName,
      message: message.message,
      timestamp: message.timestamp
    });

    logger.info('Agent reply sent to user', { userId, ticketId: message.ticketId });
  }

  // Update ticket status for all stakeholders
  updateTicketStatus(ticketData: any, eventType: string) {
    if (!this.io) return;

    // Notify user
    this.io.to(`user_${ticketData.userId}`).emit('ticket_update', {
      type: eventType,
      ticketId: ticketData.ticketId,
      status: ticketData.status,
      timestamp: new Date()
    });

    // Notify agents
    this.io.to('agent_room').emit('ticket_update', {
      type: eventType,
      ticketId: ticketData.ticketId,
      status: ticketData.status,
      userId: ticketData.userId,
      timestamp: new Date()
    });

    logger.info('Ticket status update broadcasted', { 
      ticketId: ticketData.ticketId, 
      eventType, 
      status: ticketData.status 
    });
  }

  getServiceStatus() {
    return {
      isInitialized: this.io !== null,
      activeSessions: this.activeSessions.size,
      connectedUsers: this.userSocketMap.size,
      connectedAgents: this.agentSocketMap.size
    };
  }

  shutdown() {
    if (this.sessionCleanupInterval) {
      clearInterval(this.sessionCleanupInterval);
    }
    
    if (this.io) {
      this.io.close();
    }
    
    this.activeSessions.clear();
    this.userSocketMap.clear();
    this.agentSocketMap.clear();
    
    logger.info('Socket service shut down');
  }
}

// Export singleton instance
export const socketService = new SocketService();
export { SocketService };