import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import './AIChatWidget.css';

interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'agent' | 'ai';
  message: string;
  timestamp: Date;
  ticketId?: string;
}

interface ChatSession {
  sessionId: string;
  isConnectedToAgent: boolean;
  agentName?: string;
}

const AIChatWidget: React.FC = () => {
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(true); // Start as online for better UX
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showHumanSupportOption, setShowHumanSupportOption] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socketFailed, setSocketFailed] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const API_BASE_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_URL || 'http://localhost:4000';

  useEffect(() => {
    if (isOpen) {
      if (!socketRef.current) {
        initializeSocket();
      }
      // Also initialize chat immediately for better UX
      if (messages.length === 0) {
        initializeChat();
      }
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, [isOpen, token]);

  useEffect(() => {
    scrollToBottom();
    if (isOpen) {
      setUnreadCount(0);
    }
  }, [messages, isOpen]);

  const initializeSocket = () => {
    const socketUrl = API_BASE_URL.replace('/api', '');
    console.log('Attempting to connect to:', socketUrl);
    
    socketRef.current = io(socketUrl, {
      auth: {
        token: token || localStorage.getItem('authToken') || undefined
      },
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true
    });

    const socket = socketRef.current;

    socket.on('connect', () => {
      console.log('Connected to chat server');
      setIsConnected(true);
      initializeChat();
    });

    socket.on('disconnect', (reason) => {
      console.log('Disconnected from chat server:', reason);
      // Keep showing as connected but note socket failure
      setSocketFailed(true);
      setIsLoading(false);
      
      // Don't show offline message to maintain better UX
      console.log('Socket disconnected, falling back to local AI responses');
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setSocketFailed(true);
      setIsLoading(false);
      console.log('Socket connection failed, using fallback AI responses');
    });

    socket.on('chat_initialized', (data) => {
      setChatSession({
        sessionId: data.sessionId,
        isConnectedToAgent: false
      });
      setMessages([data.message]);
    });

    socket.on('chat_message', (message: ChatMessage) => {
      setMessages(prev => [...prev, message]);
      setIsLoading(false);
      
      if (!isOpen && message.senderRole !== 'user') {
        setUnreadCount(prev => prev + 1);
      }
    });

    socket.on('human_support_suggested', (data) => {
      setShowHumanSupportOption(true);
    });

    socket.on('agent_joined', (data) => {
      setChatSession(prev => prev ? {
        ...prev,
        isConnectedToAgent: true,
        agentName: data.agentName
      } : null);

      const agentJoinedMessage: ChatMessage = {
        id: `agent_joined_${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'ai',
        message: data.message,
        timestamp: new Date()
      };
      
      setMessages(prev => [...prev, agentJoinedMessage]);
      setShowHumanSupportOption(false);
    });

    socket.on('typing_start', (data) => {
      if (data.userId !== (user?.id || 'guest')) {
        setIsTyping(true);
      }
    });

    socket.on('typing_stop', (data) => {
      setIsTyping(false);
    });

    socket.on('error', (error) => {
      console.error('Chat error:', error);
      setIsLoading(false);
    });
  };

  const initializeChat = () => {
    if (socketRef.current) {
      socketRef.current.emit('init_chat', {});
    } else {
      // Initialize with welcome message if no socket connection
      const welcomeMessage: ChatMessage = {
        id: `welcome_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: 'Hi there! 🌟 I\'m your Trek Tribe assistant. I can help you with trip information, booking questions, and more. What would you like to know?',
        timestamp: new Date()
      };
      setMessages([welcomeMessage]);
    }
  };

  // Fallback AI responses when socket is not available
  const getFallbackResponse = (message: string): string => {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
      return 'Hello! 😊 I\'m here to help you with your Trek Tribe adventure. What would you like to know about our trips?';
    }
    
    // Advanced features trigger
    if (lowerMessage.includes('recommend') || lowerMessage.includes('suggest') || lowerMessage.includes('best trip')) {
      setTimeout(() => getSmartRecommendations(), 500);
      return 'Let me get personalized trip recommendations for you based on your interests! 🎯';
    }
    
    if (lowerMessage.includes('availability') || lowerMessage.includes('available') || lowerMessage.includes('spots left')) {
      setTimeout(() => checkTripAvailability(), 500);
      return 'Checking real-time availability for you! ⏰';
    }
    
    if (lowerMessage.includes('organizer') || lowerMessage.includes('guide') || lowerMessage.includes('leader')) {
      setTimeout(() => getOrganizerInfo(), 500);
      return 'Let me tell you about our amazing trek leaders! 🏔️';
    }
    
    if (lowerMessage.includes('my trips') || lowerMessage.includes('history') || lowerMessage.includes('analytics')) {
      setTimeout(() => getUserAnalytics(), 500);
      return 'Pulling up your travel analytics and preferences! 📊';
    }
    
    if (lowerMessage.includes('help me book') || lowerMessage.includes('booking help') || lowerMessage.includes('how to book')) {
      setTimeout(() => getBookingAssistance(), 500);
      return 'I\'ll guide you through the booking process step by step! 🚀';
    }
    
    if (lowerMessage.includes('price') || lowerMessage.includes('cost') || lowerMessage.includes('payment')) {
      return 'For pricing information, please check our trip listings or contact our support team. Prices vary based on destination, duration, and package options. 💰';
    }
    
    if (lowerMessage.includes('book') || lowerMessage.includes('reserve')) {
      return 'To book a trip, browse our available adventures and click the "Join Trip" button. You\'ll be able to select your preferred package and complete the booking process! 🎪';
    }
    
    if (lowerMessage.includes('cancel') || lowerMessage.includes('refund')) {
      return 'Cancellation policies vary by trip. Please check the specific trip details or contact our support team for assistance with cancellations and refunds. 🔄';
    }
    
    if (lowerMessage.includes('support') || lowerMessage.includes('help') || lowerMessage.includes('contact')) {
      return 'For immediate assistance, you can connect with our human support team using the "Talk to a Human Agent" button below, or email us at support@trektribe.com 👥';
    }
    
    if (lowerMessage.includes('trip') || lowerMessage.includes('adventure') || lowerMessage.includes('destination')) {
      return 'We offer amazing adventures across various destinations! Check out our trip listings to explore options like mountain treks, cultural journeys, beach getaways, and more. Each trip includes detailed itineraries and package options. 🏔️';
    }
    
    // Default response
    return 'Thanks for your message! While I try to help with common questions, our human support team can provide more detailed assistance. Feel free to connect with an agent below or browse our trip listings for more information! 🌟';
  };

  const sendFallbackResponse = (userMessage: string) => {
    setTimeout(() => {
      const response: ChatMessage = {
        id: `fallback_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: getFallbackResponse(userMessage),
        timestamp: new Date()
      };
      setMessages(prev => [...prev, response]);
      setIsLoading(false);
    }, 1000 + Math.random() * 2000); // Random delay between 1-3 seconds
  };

  // Advanced AI features
  const getSmartRecommendations = async (preferences?: any) => {
    try {
      const response = await api.post('/chat/recommendations', {
        preferences: preferences || {
          budget: { min: 2000, max: 15000 },
          difficulty: 'intermediate',
          interests: ['adventure', 'nature']
        },
        context: {
          currentPage: window.location.pathname,
          previousMessages: messages.slice(-5)
        }
      });

      const aiMessage: ChatMessage = {
        id: `recommendations_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: response.data.data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
      return response.data.data.recommendations;
    } catch (error) {
      console.error('Error getting recommendations:', error);
      const errorMessage: ChatMessage = {
        id: `error_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: 'I apologize, but I\'m having trouble getting personalized recommendations right now. You can browse our amazing trips directly on the trips page!',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const checkTripAvailability = async (tripId?: string) => {
    try {
      const currentTripId = tripId || getCurrentTripId();
      if (!currentTripId) {
        const message: ChatMessage = {
          id: `availability_error_${Date.now()}`,
          senderId: 'ai',
          senderName: 'Trek Tribe Assistant',
          senderRole: 'ai',
          message: 'To check availability, please visit a specific trip page or let me know which trip you\'re interested in!',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, message]);
        return;
      }

      const response = await api.get(`/chat/trip-availability/${currentTripId}`);
      
      const aiMessage: ChatMessage = {
        id: `availability_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: response.data.data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error checking availability:', error);
      const errorMessage: ChatMessage = {
        id: `availability_error_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: 'I couldn\'t check the availability right now, but you can see real-time availability on the trip page!',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const getOrganizerInfo = async (tripId?: string) => {
    try {
      const currentTripId = tripId || getCurrentTripId();
      if (!currentTripId) {
        const message: ChatMessage = {
          id: `organizer_error_${Date.now()}`,
          senderId: 'ai',
          senderName: 'Trek Tribe Assistant',
          senderRole: 'ai',
          message: 'To learn about the organizer, please visit a specific trip page!',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, message]);
        return;
      }

      const response = await api.get(`/chat/organizer-profile/${currentTripId}`);
      
      const aiMessage: ChatMessage = {
        id: `organizer_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: response.data.data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting organizer info:', error);
      const errorMessage: ChatMessage = {
        id: `organizer_error_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: 'I couldn\'t get organizer information right now, but you can find detailed organizer profiles on each trip page!',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const getUserAnalytics = async () => {
    try {
      const response = await api.get('/chat/user-analytics');
      
      const aiMessage: ChatMessage = {
        id: `analytics_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: response.data.data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting user analytics:', error);
      const errorMessage: ChatMessage = {
        id: `analytics_error_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: user ? 'I couldn\'t access your travel history right now. You can view your bookings in your profile!' : 'Please log in to see your personalized travel analytics and recommendations!',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const getBookingAssistance = async (step?: string) => {
    try {
      const tripId = getCurrentTripId();
      const response = await api.post('/chat/booking-assistance', {
        tripId,
        step
      });
      
      const aiMessage: ChatMessage = {
        id: `booking_assist_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: response.data.data.message,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error getting booking assistance:', error);
      const errorMessage: ChatMessage = {
        id: `booking_error_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: 'I can help guide you through the booking process! Visit any trip page and click "Join Trip" to get started. I\'ll be here to help if you need assistance!',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `user_${Date.now()}`,
      senderId: user?.id || 'guest',
      senderName: user?.name || 'You',
      senderRole: 'user',
      message: messageText,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    // Check if socket is available and connected
    if (socketRef.current && isConnected && !socketFailed) {
      // Stop typing indicator
      socketRef.current.emit('typing_stop', { sessionId: chatSession?.sessionId });

      if (chatSession?.isConnectedToAgent) {
        // Send to human agent
        socketRef.current.emit('agent_chat_message', {
          sessionId: chatSession.sessionId,
          message: messageText
        });
      } else {
        // Send to AI
        socketRef.current.emit('ai_chat_message', {
          message: messageText,
          context: {
            tripId: getCurrentTripId()
          }
        });
      }
    } else {
      // Use fallback AI response
      sendFallbackResponse(messageText);
    }
  };

  const requestHumanAgent = () => {
    // Always create a queue message to show the request was received
    const agentRequestMessage: ChatMessage = {
      id: `agent_request_${Date.now()}`,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'ai',
      message: '🎧 I\'ve connected you with our human support team. An agent will be with you shortly! In the meantime, feel free to ask any questions.',
      timestamp: new Date()
    };
    setMessages(prev => [...prev, agentRequestMessage]);

    // Try to emit socket event if available
    if (socketRef.current && !socketFailed) {
      if (!chatSession) {
        // Create a temporary session for human agent request
        socketRef.current.emit('request_human_agent', {
          reason: 'Direct human support requested',
          urgency: 'medium',
          userInfo: {
            name: user?.name || 'Guest',
            email: user?.email,
            currentPage: window.location.pathname
          }
        });
      } else {
        socketRef.current.emit('request_human_agent', {
          sessionId: chatSession.sessionId,
          reason: 'User requested human support',
          urgency: 'medium'
        });
      }
    } else {
      // Fallback: Show that request was logged
      setTimeout(() => {
        const fallbackMessage: ChatMessage = {
          id: `fallback_agent_${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderRole: 'ai',
          message: 'Your request has been logged in our system. You can also reach out to us directly at support@trektribe.com or call us during business hours!',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, fallbackMessage]);
      }, 2000);
    }

    setShowHumanSupportOption(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);

    // Handle typing indicator
    if (socketRef.current && chatSession) {
      socketRef.current.emit('typing_start', { sessionId: chatSession.sessionId });

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 2 seconds of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        if (socketRef.current && chatSession) {
          socketRef.current.emit('typing_stop', { sessionId: chatSession.sessionId });
        }
      }, 2000);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const getCurrentTripId = (): string | undefined => {
    // Extract trip ID from current URL if on a trip page
    const path = window.location.pathname;
    const tripMatch = path.match(/\/trips\/([^\/]+)/);
    return tripMatch ? tripMatch[1] : undefined;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const getSenderDisplayName = (message: ChatMessage) => {
    if (message.senderRole === 'ai') return 'Trek Tribe Assistant';
    if (message.senderRole === 'agent') return message.senderName;
    if (message.senderId === (user?.id || 'guest')) return 'You';
    return message.senderName;
  };

  if (!isOpen) {
    return (
      <div className="chat-widget-toggle" onClick={() => setIsOpen(true)}>
        <div className="chat-icon">💬</div>
        {unreadCount > 0 && (
          <div className="unread-badge">{unreadCount}</div>
        )}
        <div className="chat-tooltip">Need help? Chat with us!</div>
      </div>
    );
  }

  return (
    <div className="chat-widget-container">
      <div className="chat-widget">
        <div className="chat-header">
          <div className="chat-header-info">
            <h3>
              {chatSession?.isConnectedToAgent 
                ? `Chat with ${chatSession.agentName}` 
                : 'Trek Tribe Support'}
            </h3>
            <div className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Online' : '🔴 Offline'}
            </div>
          </div>
          <button 
            className="chat-close-btn" 
            onClick={() => setIsOpen(false)}
            aria-label="Close chat"
          >
            ×
          </button>
        </div>

        <div className="chat-messages">
          
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.senderId === (user?.id || 'guest') ? 'user' : 'assistant'} ${message.senderRole}`}
            >
              <div className="message-header">
                <span className="message-sender">
                  {getSenderDisplayName(message)}
                </span>
                <span className="message-timestamp">
                  {formatTimestamp(message.timestamp)}
                </span>
              </div>
              <div className="message-content">
                {message.message}
              </div>
              {message.ticketId && (
                <div className="message-ticket-info">
                  Ticket: {message.ticketId}
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="typing-indicator">
              <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span className="typing-text">Assistant is typing...</span>
            </div>
          )}

          {isLoading && (
            <div className="loading-indicator">
              <div className="loading-spinner"></div>
              <span>Processing your message...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {showHumanSupportOption && (
          <div className="human-support-banner">
            <div className="banner-content">
              <span>💁‍♀️ I think you might need human assistance with this.</span>
              <button 
                className="request-human-btn"
                onClick={requestHumanAgent}
              >
                Connect to Agent
              </button>
            </div>
          </div>
        )}

        <div className="chat-input-container">
          <div className="chat-input-wrapper">
            <input
              type="text"
              value={inputMessage}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder={
                chatSession?.isConnectedToAgent 
                  ? `Message ${chatSession.agentName}...`
                  : "Ask me anything about your trip..."
              }
              disabled={isLoading}
              className="chat-input"
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className="send-button"
              aria-label="Send message"
            >
              {isLoading ? '⏳' : '➤'}
            </button>
          </div>

          {!chatSession?.isConnectedToAgent && (
            <div className="chat-footer">
              <div className="smart-actions-grid">
                <button 
                  className="smart-action-btn"
                  onClick={() => getSmartRecommendations()}
                  title="Get AI-powered trip recommendations"
                >
                  🎯 Get Recommendations
                </button>
                
                <button 
                  className="smart-action-btn"
                  onClick={() => checkTripAvailability()}
                  title="Check real-time availability"
                >
                  ⏰ Check Availability
                </button>
                
                {user && (
                  <button 
                    className="smart-action-btn"
                    onClick={() => getUserAnalytics()}
                    title="View your travel analytics"
                  >
                    📊 My Analytics
                  </button>
                )}
                
                <button 
                  className="smart-action-btn"
                  onClick={() => getBookingAssistance()}
                  title="Get help with booking"
                >
                  🚀 Booking Help
                </button>
              </div>
              
              <button 
                className="human-agent-request-btn"
                onClick={requestHumanAgent}
                disabled={false} // Always allow agent request even if bot is offline
                title={!isConnected ? 'Bot is offline - connect to human agent directly' : 'Request human support'}
              >
                🧑‍💼 {!isConnected ? 'Bot Offline - Get Human Help' : 'Talk to a Human Agent'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIChatWidget;