import React, { useState, useEffect, useRef, useCallback } from 'react';
import { socketService, ChatMessage, TypingIndicator } from '../services/socketService';
import { chatAPI, getUserFromStorage, getAuthToken } from '../config/api';

interface RealTimeChatWidgetProps {
  isAuthenticated?: boolean;
  onAuthRequired?: () => void;
}

interface ChatSession {
  roomId: string;
  status: 'waiting' | 'active' | 'closed';
  assignedAgent?: {
    id: string;
    name: string;
    avatar?: string;
  };
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  waitTime?: number;
  queuePosition?: number;
}

const RealTimeChatWidget: React.FC<RealTimeChatWidgetProps> = ({ 
  isAuthenticated = false, 
  onAuthRequired 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [chatSession, setChatSession] = useState<ChatSession | null>(null);
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showStartChat, setShowStartChat] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [feedback, setFeedback] = useState('');
  const [showFeedback, setShowFeedback] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const user = getUserFromStorage();

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Initialize socket connection
  const initializeSocket = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    const token = getAuthToken();
    if (!token) return;

    setIsConnecting(true);
    setConnectionError(null);

    try {
      await socketService.initialize(token, user.id);
      setIsConnected(true);

      // Setup event listeners
      socketService.onMessageReceived(handleMessageReceived);
      socketService.onTypingIndicator(handleTypingIndicator);
      socketService.onChatAssigned(handleChatAssigned);
      socketService.onChatClosed(handleChatClosed);
      socketService.onError(handleSocketError);

    } catch (error: any) {
      console.error('Socket connection failed:', error);
      setConnectionError(error.message || 'Failed to connect to chat server');
    } finally {
      setIsConnecting(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (isOpen && isAuthenticated && !isConnected && !isConnecting) {
      initializeSocket();
    }

    return () => {
      if (chatSession?.roomId) {
        socketService.leaveRoom(chatSession.roomId);
      }
    };
  }, [isOpen, isAuthenticated, isConnected, isConnecting, initializeSocket, chatSession]);

  // Socket event handlers
  const handleMessageReceived = useCallback((message: ChatMessage) => {
    setMessages(prev => {
      // Avoid duplicate messages
      if (prev.find(m => m.id === message.id)) return prev;
      return [...prev, message];
    });

    // Mark message as read if chat is open
    if (isOpen && message.senderId !== user?.id) {
      setTimeout(() => {
        socketService.markMessagesAsRead(message.roomId, [message.id]);
      }, 1000);
    }
  }, [isOpen, user]);

  const handleTypingIndicator = useCallback((data: TypingIndicator) => {
    setTypingUsers(prev => {
      const filtered = prev.filter(t => 
        t.roomId !== data.roomId || t.userId !== data.userId
      );
      
      if (data.isTyping && data.userId !== user?.id) {
        return [...filtered, data];
      }
      
      return filtered;
    });
  }, [user]);

  const handleChatAssigned = useCallback((data: { roomId: string; agentId: string; agentName: string }) => {
    setChatSession(prev => prev ? {
      ...prev,
      status: 'active',
      assignedAgent: {
        id: data.agentId,
        name: data.agentName
      }
    } : null);

    // Add system message
    const systemMessage: ChatMessage = {
      id: `system-${Date.now()}`,
      roomId: data.roomId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'agent',
      content: `${data.agentName} has joined the chat and will assist you.`,
      messageType: 'system',
      timestamp: new Date(),
      readBy: []
    };
    
    setMessages(prev => [...prev, systemMessage]);
  }, []);

  const handleChatClosed = useCallback((data: { roomId: string; closedBy: string; reason?: string }) => {
    setChatSession(prev => prev ? { ...prev, status: 'closed' } : null);
    setShowFeedback(true);

    // Add system message
    const systemMessage: ChatMessage = {
      id: `system-close-${Date.now()}`,
      roomId: data.roomId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'agent',
      content: data.reason ? 
        `Chat has been closed. Reason: ${data.reason}` : 
        'Chat has been closed. Thank you for contacting Trek Tribe!',
      messageType: 'system',
      timestamp: new Date(),
      readBy: []
    };
    
    setMessages(prev => [...prev, systemMessage]);
  }, []);

  const handleSocketError = useCallback((error: { message: string; code?: string }) => {
    console.error('Socket error:', error);
    setConnectionError(error.message);
  }, []);

  // Start new chat session
  const startChat = async (category: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium') => {
    if (!isAuthenticated) {
      onAuthRequired?.();
      return;
    }

    setIsLoading(true);
    setConnectionError(null);

    try {
      const response = await chatAPI.startChat({ category, priority });
      
      if (response.data.success) {
        const newSession: ChatSession = {
          roomId: response.data.roomId,
          status: 'waiting',
          priority,
          category,
          waitTime: response.data.estimatedWaitTime,
          queuePosition: response.data.queuePosition
        };

        setChatSession(newSession);
        setShowStartChat(false);

        // Join the chat room
        socketService.joinRoom(newSession.roomId);

        // Add welcome message
        const welcomeMessage: ChatMessage = {
          id: `welcome-${Date.now()}`,
          roomId: newSession.roomId,
          senderId: 'system',
          senderName: 'System',
          senderRole: 'agent',
          content: `Welcome to Trek Tribe Support! You're ${newSession.queuePosition ? `#${newSession.queuePosition} in queue` : 'connected'}. ${newSession.waitTime ? `Estimated wait time: ${Math.ceil(newSession.waitTime / 60)} minutes.` : 'An agent will be with you shortly.'}`,
          messageType: 'system',
          timestamp: new Date(),
          readBy: []
        };

        setMessages([welcomeMessage]);
      }
    } catch (error: any) {
      console.error('Failed to start chat:', error);
      setConnectionError(error.response?.data?.message || 'Failed to start chat session');
    } finally {
      setIsLoading(false);
    }
  };

  // Send message
  const sendMessage = async () => {
    if (!inputMessage.trim() || !chatSession || !isConnected) return;

    const messageContent = inputMessage.trim();
    setInputMessage('');

    // Stop typing indicator
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    socketService.stopTyping(chatSession.roomId);

    // Send message via socket
    socketService.sendMessage(chatSession.roomId, messageContent);
  };

  // Handle typing
  const handleTyping = (value: string) => {
    setInputMessage(value);

    if (!chatSession || !isConnected) return;

    // Start typing indicator
    socketService.startTyping(chatSession.roomId);

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(chatSession.roomId);
    }, 3000);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Close chat
  const closeChat = async () => {
    if (!chatSession) return;

    try {
      await chatAPI.closeChat(chatSession.roomId, {
        reason: 'User closed chat',
        satisfaction: satisfaction || undefined,
        feedback
      });
      
      socketService.leaveRoom(chatSession.roomId);
      setChatSession(null);
      setMessages([]);
      setShowStartChat(true);
      setShowFeedback(false);
      setSatisfaction(null);
      setFeedback('');
    } catch (error) {
      console.error('Failed to close chat:', error);
    }
  };

  // Toggle widget
  const toggleWidget = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  // Render typing indicator
  const renderTypingIndicator = () => {
    const currentRoomTyping = typingUsers.filter(t => 
      t.roomId === chatSession?.roomId && t.isTyping
    );

    if (currentRoomTyping.length === 0) return null;

    return (
      <div className="flex justify-start mb-2">
        <div className="bg-gray-100 px-3 py-2 rounded-lg">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
            <span>{currentRoomTyping[0].userName} is typing...</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={toggleWidget}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 z-50"
          aria-label="Open chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {/* Unread message indicator */}
          {messages.some(m => m.senderId !== user?.id && !m.readBy.includes(user?.id)) && (
            <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
              !
            </div>
          )}
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-t-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                {chatSession?.assignedAgent ? '👨‍💼' : '🏔️'}
              </div>
              <div>
                <h3 className="font-semibold text-sm">
                  {chatSession?.assignedAgent ? chatSession.assignedAgent.name : 'Trek Tribe Support'}
                </h3>
                <p className="text-xs text-blue-100">
                  {!isAuthenticated ? 'Please log in to chat' :
                   !isConnected ? (isConnecting ? 'Connecting...' : 'Disconnected') :
                   chatSession?.status === 'waiting' ? 'Waiting for agent...' :
                   chatSession?.status === 'active' ? 'Online • Ready to help!' :
                   chatSession?.status === 'closed' ? 'Chat closed' :
                   'Ready to help!'}
                </p>
              </div>
            </div>
            <button
              onClick={toggleWidget}
              className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
              title="Close chat"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Connection Error */}
          {connectionError && (
            <div className="p-3 bg-red-50 border-b border-red-200">
              <div className="flex items-center space-x-2">
                <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm text-red-700">{connectionError}</span>
                <button 
                  onClick={initializeSocket}
                  className="ml-auto text-xs text-red-600 hover:text-red-800 underline"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Chat Start Screen */}
          {showStartChat && !chatSession && (
            <div className="flex-1 flex flex-col justify-center items-center p-6 bg-gray-50">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Need Help?</h3>
                <p className="text-sm text-gray-600 mb-6">Start a conversation with our support team</p>
              </div>

              {!isAuthenticated ? (
                <button
                  onClick={onAuthRequired}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-4 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors font-medium"
                >
                  Login to Start Chat
                </button>
              ) : (
                <div className="w-full space-y-3">
                  <button
                    onClick={() => startChat('general', 'medium')}
                    disabled={isLoading || !isConnected}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white py-3 px-4 rounded-lg hover:from-blue-600 hover:to-purple-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Starting Chat...' : 'Start Chat'}
                  </button>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => startChat('technical', 'high')}
                      disabled={isLoading || !isConnected}
                      className="text-xs py-2 px-3 bg-orange-100 text-orange-700 rounded-lg hover:bg-orange-200 transition-colors disabled:opacity-50"
                    >
                      🔧 Technical Issue
                    </button>
                    <button
                      onClick={() => startChat('booking', 'high')}
                      disabled={isLoading || !isConnected}
                      className="text-xs py-2 px-3 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors disabled:opacity-50"
                    >
                      🎫 Booking Help
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Messages */}
          {chatSession && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                      message.messageType === 'system'
                        ? 'bg-blue-50 text-blue-800 text-center mx-auto border border-blue-200'
                        : message.senderRole === 'user'
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
                        : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                    }`}
                  >
                    {message.senderRole === 'agent' && message.messageType !== 'system' && (
                      <div className="flex items-center space-x-2 mb-2">
                        <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white text-xs">
                          👨‍💼
                        </div>
                        <span className="text-xs text-gray-500 font-medium">{message.senderName}</span>
                      </div>
                    )}
                    
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                    
                    {message.messageType !== 'system' && (
                      <div className="text-xs opacity-50 mt-2">
                        {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {renderTypingIndicator()}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Feedback Form */}
          {showFeedback && chatSession?.status === 'closed' && (
            <div className="p-4 bg-blue-50 border-t border-blue-200">
              <h4 className="text-sm font-medium text-blue-800 mb-3">How was your experience?</h4>
              
              <div className="flex space-x-1 mb-3">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => setSatisfaction(rating)}
                    className={`text-xl ${satisfaction && satisfaction >= rating ? 'text-yellow-500' : 'text-gray-300'} hover:text-yellow-500 transition-colors`}
                  >
                    ⭐
                  </button>
                ))}
              </div>

              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Optional feedback..."
                className="w-full text-xs p-2 border border-blue-200 rounded-lg mb-3 resize-none"
                rows={2}
              />

              <div className="flex space-x-2">
                <button
                  onClick={closeChat}
                  className="flex-1 text-xs py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Submit & Close
                </button>
                <button
                  onClick={() => setShowFeedback(false)}
                  className="text-xs py-2 px-3 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  Skip
                </button>
              </div>
            </div>
          )}

          {/* Input */}
          {chatSession && chatSession.status !== 'closed' && (
            <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
              <div className="flex items-end space-x-2">
                <div className="flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputMessage}
                    onChange={(e) => handleTyping(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={chatSession.status === 'waiting' ? 'Waiting for agent...' : 'Type your message...'}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                    disabled={!isConnected || chatSession.status === 'waiting'}
                  />
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || !isConnected || chatSession.status === 'waiting'}
                  className="p-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-lg hover:from-blue-600 hover:to-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <div className="text-xs text-gray-500 mt-1 text-center">
                Press Enter to send • Powered by Trek Tribe
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default RealTimeChatWidget;