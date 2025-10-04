import React, { useState, useEffect, useRef, useCallback } from 'react';
import { socketService, ChatMessage, TypingIndicator } from '../services/socketService';
import { chatAPI, getUserFromStorage, getAuthToken } from '../config/api';

interface ChatSession {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  status: 'waiting' | 'active' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: string;
  unreadCount: number;
  waitTime?: number;
}

interface AgentChatDashboardProps {
  onAuthRequired?: () => void;
}

const AgentChatDashboard: React.FC<AgentChatDashboardProps> = ({ onAuthRequired }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [activeSessions, setActiveSessions] = useState<ChatSession[]>([]);
  const [unassignedChats, setUnassignedChats] = useState<ChatSession[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatSession | null>(null);
  const [messages, setMessages] = useState<{ [roomId: string]: ChatMessage[] }>({});
  const [inputMessages, setInputMessages] = useState<{ [roomId: string]: string }>({});
  const [typingUsers, setTypingUsers] = useState<TypingIndicator[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<'online' | 'busy' | 'offline'>('online');
  const [analytics, setAnalytics] = useState({
    totalChats: 0,
    activeChats: 0,
    avgResponseTime: 0,
    satisfactionScore: 0
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<{ [roomId: string]: HTMLInputElement }>({});
  const typingTimeouts = useRef<{ [roomId: string]: NodeJS.Timeout }>({});
  const user = getUserFromStorage();

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    if (selectedChat) {
      scrollToBottom();
    }
  }, [messages, selectedChat, scrollToBottom]);

  // Initialize socket connection
  const initializeSocket = useCallback(async () => {
    if (!user || user.role !== 'agent') {
      onAuthRequired?.();
      return;
    }

    const token = getAuthToken();
    if (!token) {
      onAuthRequired?.();
      return;
    }

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
      socketService.onUserJoined(handleUserJoined);
      socketService.onUserLeft(handleUserLeft);
      socketService.onError(handleSocketError);

      // Load initial data
      await loadChatData();

    } catch (error: any) {
      console.error('Socket connection failed:', error);
      setConnectionError(error.message || 'Failed to connect to chat server');
    } finally {
      setIsConnecting(false);
    }
  }, [user, onAuthRequired]);

  useEffect(() => {
    initializeSocket();

    return () => {
      // Cleanup on unmount
      Object.values(typingTimeouts.current).forEach(clearTimeout);
      socketService.disconnect();
    };
  }, [initializeSocket]);

  // Load chat data
  const loadChatData = async () => {
    setIsLoading(true);
    try {
      const [assignedResponse, unassignedResponse, analyticsResponse] = await Promise.all([
        chatAPI.getAssignedChats(),
        chatAPI.getUnassignedChats(),
        chatAPI.getChatAnalytics('today')
      ]);

      setActiveSessions(assignedResponse.data.chats || []);
      setUnassignedChats(unassignedResponse.data.chats || []);
      setAnalytics(analyticsResponse.data.analytics || analytics);

      // Join rooms for active sessions
      (assignedResponse.data.chats || []).forEach((chat: ChatSession) => {
        socketService.joinRoom(chat.roomId);
      });

    } catch (error: any) {
      console.error('Failed to load chat data:', error);
      setConnectionError(error.response?.data?.message || 'Failed to load chat data');
    } finally {
      setIsLoading(false);
    }
  };

  // Socket event handlers
  const handleMessageReceived = useCallback((message: ChatMessage) => {
    setMessages(prev => ({
      ...prev,
      [message.roomId]: [...(prev[message.roomId] || []), message]
    }));

    // Update last message in session list
    setActiveSessions(prev => prev.map(session => 
      session.roomId === message.roomId ? {
        ...session,
        lastMessage: message.content.substring(0, 50) + (message.content.length > 50 ? '...' : ''),
        unreadCount: message.senderId !== user?.id ? session.unreadCount + 1 : session.unreadCount,
        updatedAt: new Date()
      } : session
    ));

    // Mark as read if this chat is currently selected
    if (selectedChat?.roomId === message.roomId && message.senderId !== user?.id) {
      setTimeout(() => {
        socketService.markMessagesAsRead(message.roomId, [message.id]);
      }, 1000);
    }
  }, [selectedChat, user]);

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
    if (data.agentId === user?.id) {
      // Refresh data to get new assignment
      loadChatData();
    }
  }, [user]);

  const handleChatClosed = useCallback((data: { roomId: string; closedBy: string; reason?: string }) => {
    // Remove from active sessions
    setActiveSessions(prev => prev.filter(s => s.roomId !== data.roomId));
    
    // Clear messages for closed chat
    setMessages(prev => {
      const newMessages = { ...prev };
      delete newMessages[data.roomId];
      return newMessages;
    });

    // Clear input message
    setInputMessages(prev => {
      const newInputs = { ...prev };
      delete newInputs[data.roomId];
      return newInputs;
    });

    // If this was the selected chat, clear selection
    if (selectedChat?.roomId === data.roomId) {
      setSelectedChat(null);
    }

    socketService.leaveRoom(data.roomId);
  }, [selectedChat]);

  const handleUserJoined = useCallback((data: { roomId: string; userId: string; userName: string }) => {
    // Add system message
    const systemMessage: ChatMessage = {
      id: `system-join-${Date.now()}`,
      roomId: data.roomId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'agent',
      content: `${data.userName} joined the chat`,
      messageType: 'system',
      timestamp: new Date(),
      readBy: []
    };

    setMessages(prev => ({
      ...prev,
      [data.roomId]: [...(prev[data.roomId] || []), systemMessage]
    }));
  }, []);

  const handleUserLeft = useCallback((data: { roomId: string; userId: string; userName: string }) => {
    // Add system message
    const systemMessage: ChatMessage = {
      id: `system-leave-${Date.now()}`,
      roomId: data.roomId,
      senderId: 'system',
      senderName: 'System',
      senderRole: 'agent',
      content: `${data.userName} left the chat`,
      messageType: 'system',
      timestamp: new Date(),
      readBy: []
    };

    setMessages(prev => ({
      ...prev,
      [data.roomId]: [...(prev[data.roomId] || []), systemMessage]
    }));
  }, []);

  const handleSocketError = useCallback((error: { message: string; code?: string }) => {
    console.error('Socket error:', error);
    setConnectionError(error.message);
  }, []);

  // Take unassigned chat
  const takeChat = async (roomId: string) => {
    try {
      await chatAPI.takeChat(roomId);
      socketService.takeChat(roomId);
      
      // Refresh data
      await loadChatData();
      
      // Select the newly taken chat
      const takenChat = unassignedChats.find(chat => chat.roomId === roomId);
      if (takenChat) {
        setSelectedChat(takenChat);
        socketService.joinRoom(roomId);
      }
      
    } catch (error: any) {
      console.error('Failed to take chat:', error);
    }
  };

  // Send message
  const sendMessage = async (roomId: string) => {
    const messageContent = inputMessages[roomId]?.trim();
    if (!messageContent || !isConnected) return;

    // Clear input
    setInputMessages(prev => ({ ...prev, [roomId]: '' }));

    // Stop typing indicator
    if (typingTimeouts.current[roomId]) {
      clearTimeout(typingTimeouts.current[roomId]);
      delete typingTimeouts.current[roomId];
    }
    socketService.stopTyping(roomId);

    // Send message
    socketService.sendMessage(roomId, messageContent);
  };

  // Handle typing
  const handleTyping = (roomId: string, value: string) => {
    setInputMessages(prev => ({ ...prev, [roomId]: value }));

    if (!isConnected) return;

    // Start typing indicator
    socketService.startTyping(roomId);

    // Clear existing timeout
    if (typingTimeouts.current[roomId]) {
      clearTimeout(typingTimeouts.current[roomId]);
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeouts.current[roomId] = setTimeout(() => {
      socketService.stopTyping(roomId);
      delete typingTimeouts.current[roomId];
    }, 3000);
  };

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent, roomId: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(roomId);
    }
  };

  // Close chat
  const closeChat = async (roomId: string) => {
    try {
      await chatAPI.closeChat(roomId, { reason: 'Resolved by agent' });
      socketService.closeChat(roomId, 'Resolved by agent');
    } catch (error: any) {
      console.error('Failed to close chat:', error);
    }
  };

  // Transfer chat
  const transferChat = async (roomId: string, reason: string = 'Transferred to another agent') => {
    try {
      await chatAPI.transferChat(roomId, { reason });
      socketService.transferChat(roomId, undefined, reason);
    } catch (error: any) {
      console.error('Failed to transfer chat:', error);
    }
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-600 bg-red-100';
      case 'high': return 'text-orange-600 bg-orange-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  // Render typing indicator
  const renderTypingIndicator = (roomId: string) => {
    const currentRoomTyping = typingUsers.filter(t => 
      t.roomId === roomId && t.isTyping && t.userId !== user?.id
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

  if (!user || user.role !== 'agent') {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">You need agent privileges to access this dashboard.</p>
          <button
            onClick={onAuthRequired}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Login as Agent
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 bg-blue-600 text-white">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">Chat Dashboard</h1>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <select
                value={agentStatus}
                onChange={(e) => setAgentStatus(e.target.value as any)}
                className="text-xs bg-blue-700 text-white border border-blue-500 rounded px-2 py-1"
              >
                <option value="online">Online</option>
                <option value="busy">Busy</option>
                <option value="offline">Offline</option>
              </select>
            </div>
          </div>
          <p className="text-xs text-blue-100 mt-1">Welcome, {user?.name}</p>
        </div>

        {/* Analytics */}
        <div className="p-3 bg-blue-50 border-b border-blue-200">
          <div className="grid grid-cols-2 gap-2">
            <div className="text-center">
              <div className="text-lg font-semibold text-blue-600">{analytics.activeChats}</div>
              <div className="text-xs text-blue-500">Active Chats</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-semibold text-green-600">{analytics.satisfactionScore}</div>
              <div className="text-xs text-green-500">Satisfaction</div>
            </div>
          </div>
        </div>

        {/* Connection Error */}
        {connectionError && (
          <div className="p-3 bg-red-50 border-b border-red-200">
            <div className="flex items-center space-x-2">
              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span className="text-xs text-red-700">{connectionError}</span>
            </div>
          </div>
        )}

        {/* Chat Lists */}
        <div className="flex-1 overflow-y-auto">
          {/* Unassigned Chats */}
          {unassignedChats.length > 0 && (
            <div className="border-b border-gray-200">
              <div className="p-3 bg-red-50">
                <h3 className="text-sm font-medium text-red-800">Queue ({unassignedChats.length})</h3>
              </div>
              {unassignedChats.map((chat) => (
                <div
                  key={chat.id}
                  className="p-3 border-b border-gray-100 hover:bg-red-50 cursor-pointer"
                  onClick={() => takeChat(chat.roomId)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-800">{chat.userName}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(chat.priority)}`}>
                      {chat.priority}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mb-1">{chat.category}</div>
                  <div className="text-xs text-gray-500">
                    Waiting {Math.floor((Date.now() - new Date(chat.createdAt).getTime()) / 60000)}m
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Active Chats */}
          <div>
            <div className="p-3 bg-gray-50">
              <h3 className="text-sm font-medium text-gray-800">My Chats ({activeSessions.length})</h3>
            </div>
            {activeSessions.map((chat) => (
              <div
                key={chat.id}
                className={`p-3 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                  selectedChat?.id === chat.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
                onClick={() => setSelectedChat(chat)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-800">{chat.userName}</span>
                  <div className="flex items-center space-x-1">
                    {chat.unreadCount > 0 && (
                      <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                        {chat.unreadCount}
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full ${getPriorityColor(chat.priority)}`}>
                      {chat.priority}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-600 mb-1">{chat.category}</div>
                {chat.lastMessage && (
                  <div className="text-xs text-gray-500 truncate">{chat.lastMessage}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 bg-white border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">{selectedChat.userName}</h2>
                  <p className="text-sm text-gray-600">
                    {selectedChat.category} • Priority: {selectedChat.priority}
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => transferChat(selectedChat.roomId)}
                    className="px-3 py-1 text-xs bg-yellow-100 text-yellow-700 rounded hover:bg-yellow-200 transition-colors"
                  >
                    Transfer
                  </button>
                  <button
                    onClick={() => closeChat(selectedChat.roomId)}
                    className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors"
                  >
                    Close Chat
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
              <div className="space-y-4">
                {(messages[selectedChat.roomId] || []).map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.senderRole === 'agent' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] p-3 rounded-2xl text-sm ${
                        message.messageType === 'system'
                          ? 'bg-blue-50 text-blue-800 text-center mx-auto border border-blue-200'
                          : message.senderRole === 'agent'
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                      }`}
                    >
                      {message.senderRole !== 'agent' && message.messageType !== 'system' && (
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="w-5 h-5 bg-gray-300 rounded-full flex items-center justify-center text-gray-600 text-xs">
                            👤
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

                {renderTypingIndicator(selectedChat.roomId)}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {/* Message Input */}
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-end space-x-3">
                <div className="flex-1">
                  <input
                    ref={(el) => {
                      if (el) inputRefs.current[selectedChat.roomId] = el;
                    }}
                    type="text"
                    value={inputMessages[selectedChat.roomId] || ''}
                    onChange={(e) => handleTyping(selectedChat.roomId, e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, selectedChat.roomId)}
                    placeholder="Type your reply..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                    disabled={!isConnected}
                  />
                </div>
                <button
                  onClick={() => sendMessage(selectedChat.roomId)}
                  disabled={!inputMessages[selectedChat.roomId]?.trim() || !isConnected}
                  className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* No Chat Selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4 mx-auto">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Chat</h3>
              <p className="text-gray-600">Choose a chat from the sidebar to start messaging</p>
              {unassignedChats.length > 0 && (
                <p className="text-sm text-red-600 mt-2">
                  {unassignedChats.length} customer{unassignedChats.length === 1 ? '' : 's'} waiting in queue
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentChatDashboard;