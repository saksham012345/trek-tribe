import React, { useState, useEffect, useRef } from 'react';
import io, { Socket } from 'socket.io-client';
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
  const [isConnected, setIsConnected] = useState(false);
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [showHumanSupportOption, setShowHumanSupportOption] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout>();

  const API_BASE_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_URL || 'http://localhost:4000';

  useEffect(() => {
    if (isOpen && !socketRef.current) {
      initializeSocket();
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
      setIsConnected(false);
      setIsLoading(false);
      
      // Show offline message if disconnect was not intentional
      if (reason !== 'io client disconnect') {
        const offlineMessage: ChatMessage = {
          id: `offline_${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderRole: 'ai',
          message: '🔌 Connection lost. You can still request human support or try refreshing the page.',
          timestamp: new Date()
        };
        setMessages(prev => [...prev, offlineMessage]);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setIsConnected(false);
      setIsLoading(false);
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
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading || !socketRef.current) return;

    const messageText = inputMessage.trim();
    setInputMessage('');
    setIsLoading(true);

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
          tripId: getCurrentTripId() // You can implement this based on current page
        }
      });
    }
  };

  const requestHumanAgent = () => {
    if (!socketRef.current) {
      // If no socket connection, show message that request is queued
      const queuedMessage: ChatMessage = {
        id: `queued_${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'ai',
        message: '🎧 Your request for human support has been queued. An agent will connect as soon as the system is back online.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, queuedMessage]);
      setShowHumanSupportOption(false);
      return;
    }

    if (!chatSession && !isConnected) {
      // Create a temporary session for human agent request
      socketRef.current.emit('request_human_agent', {
        reason: 'Bot offline - direct human support requested',
        urgency: 'high'
      });
    } else {
      socketRef.current.emit('request_human_agent', {
        sessionId: chatSession?.sessionId,
        reason: 'User requested human support',
        urgency: 'medium'
      });
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
          {!isConnected && messages.length === 0 && (
            <div className="message assistant ai">
              <div className="message-header">
                <span className="message-sender">System</span>
                <span className="message-timestamp">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <div className="message-content">
                📵 Our AI assistant is currently offline. You can still connect with a human agent for immediate assistance!
              </div>
            </div>
          )}
          
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
              disabled={!isConnected || isLoading}
              className="chat-input"
            />
            <button
              onClick={sendMessage}
              disabled={!inputMessage.trim() || isLoading || !isConnected}
              className="send-button"
              aria-label="Send message"
            >
              {isLoading ? '⏳' : '➤'}
            </button>
          </div>

          {!chatSession?.isConnectedToAgent && (
            <div className="chat-footer">
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