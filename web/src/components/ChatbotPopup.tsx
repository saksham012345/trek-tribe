import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

interface ChatbotPopupProps {
  user?: any;
}

const ChatbotPopup: React.FC<ChatbotPopupProps> = ({ user }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [isEscalated, setIsEscalated] = useState(false);
  const [ticketNumber, setTicketNumber] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize chatbot when opened
  useEffect(() => {
    if (isOpen && messages.length === 0) {
      initializeChat();
    }
  }, [isOpen]);

  const initializeChat = async () => {
    try {
      const response = await axios.get('/chatbot/suggestions');
      if (response.data?.success) {
        setSuggestions(response.data.suggestions);
        setMessages([{
          role: 'assistant',
          content: response.data.welcomeMessage,
          timestamp: new Date()
        }]);
      }
    } catch (error) {
      console.error('Error initializing chat:', error);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      const response = await axios.post('/chatbot/chat', {
        message,
        sessionId,
        userId: user?.id
      });

      if (response.data?.success) {
        const botMessage: ChatMessage = {
          role: 'assistant',
          content: response.data.message,
          timestamp: new Date(),
          suggestions: response.data.suggestions
        };

        setMessages(prev => [...prev, botMessage]);
        setSessionId(response.data.sessionId);

        // Check if bot suggests agent escalation
        if (response.data.intent === 'agent_request' || response.data.intent === 'complaint') {
          // Add escalation suggestion
          setTimeout(() => {
            const escalationMessage: ChatMessage = {
              role: 'assistant',
              content: "Would you like me to connect you with a human agent right now? They can provide more personalized assistance.",
              timestamp: new Date(),
              suggestions: ['Yes, connect me to an agent', 'No, continue with chatbot']
            };
            setMessages(prev => [...prev, escalationMessage]);
          }, 1000);
        }
      } else {
        throw new Error('Failed to get response');
      }
    } catch (error: any) {
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: "I'm sorry, I encountered an error. Please try again or contact our support team.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = async (suggestion: string) => {
    // Check if this is an escalation request
    if (suggestion.toLowerCase().includes('connect me to an agent') || 
        suggestion.toLowerCase().includes('yes, connect me')) {
      await escalateToAgent();
      return;
    }
    
    sendMessage(suggestion);
  };

  const escalateToAgent = async () => {
    if (!sessionId) {
      console.error('No session ID available for escalation');
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post('/chatbot/escalate', {
        sessionId,
        userId: user?.id,
        reason: 'User requested human assistance',
        category: 'support',
        priority: 'medium'
      });

      if (response.data?.success) {
        setIsEscalated(true);
        setTicketNumber(response.data.ticketNumber);
        
        const escalationMessage: ChatMessage = {
          role: 'assistant',
          content: `🎯 **Connected to Human Support!**\n\nYour request has been escalated to our support team.\n\n📋 **Ticket Number:** ${response.data.ticketNumber}\n⏱️ **Estimated Wait Time:** ${response.data.estimatedWaitTime}\n👥 **Available Agents:** ${response.data.availableAgents}\n\nA human agent will be with you shortly. Please stay in this chat window.`,
          timestamp: new Date(),
          suggestions: response.data.suggestions
        };
        
        setMessages(prev => [...prev, escalationMessage]);
        
        // Start polling for agent assignment
        checkEscalationStatus();
      } else {
        throw new Error('Failed to escalate to agent');
      }
    } catch (error: any) {
      console.error('Escalation error:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: "I'm sorry, I couldn't connect you to an agent right now. Please try again or contact our support directly at support@trekktribe.com",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const checkEscalationStatus = async () => {
    if (!sessionId || !isEscalated) return;

    try {
      const response = await axios.get(`/chatbot/escalation/${sessionId}`);
      
      if (response.data?.success) {
        const { status, statusMessage, assignedAgent } = response.data;
        
        if (status === 'in_progress' && assignedAgent) {
          const agentMessage: ChatMessage = {
            role: 'assistant',
            content: `✅ **Agent Connected!**\n\nYou're now connected with **${assignedAgent.name}** from our support team. They will assist you with your query.\n\nPlease continue the conversation below.`,
            timestamp: new Date()
          };
          
          setMessages(prev => [...prev, agentMessage]);
          return; // Stop polling
        }
        
        // Continue polling if still waiting
        if (status === 'waiting') {
          setTimeout(checkEscalationStatus, 5000); // Poll every 5 seconds
        }
      }
    } catch (error) {
      console.error('Error checking escalation status:', error);
      // Stop polling on error
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputMessage);
    }
  };

  const toggleChat = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId('');
    setShowSuggestions(true);
    initializeChat();
  };

  return (
    <>
      {/* Chat Button */}
      {!isOpen && (
        <button
          onClick={toggleChat}
          className="fixed bottom-6 right-6 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 z-50"
          aria-label="Open chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center animate-pulse">
            !
          </div>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-2xl shadow-2xl z-50 flex flex-col border border-gray-200">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-t-2xl">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-white bg-opacity-20 rounded-full flex items-center justify-center">
                🏔️
              </div>
              <div>
                <h3 className="font-semibold text-sm">Trek Tribe Assistant</h3>
                <p className="text-xs text-green-100">Online • Ready to help!</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isEscalated && (
                <button
                  onClick={escalateToAgent}
                  disabled={isLoading}
                  className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors disabled:opacity-50"
                  title="Connect to human agent"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </button>
              )}
              <button
                onClick={clearChat}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="Clear chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
              <button
                onClick={toggleChat}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded transition-colors"
                title="Close chat"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                    message.role === 'user'
                      ? 'bg-gradient-to-r from-green-500 to-blue-500 text-white'
                      : 'bg-white text-gray-800 border border-gray-200 shadow-sm'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="w-5 h-5 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                        🤖
                      </div>
                      <span className="text-xs text-gray-500 font-medium">Trek Guide</span>
                    </div>
                  )}
                  
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {message.content}
                  </div>
                  
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {message.suggestions.map((suggestion, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSuggestionClick(suggestion)}
                          className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  <div className="text-xs opacity-50 mt-2">
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl border border-gray-200">
                  <div className="flex items-center space-x-2">
                    <div className="w-5 h-5 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center text-white text-xs">
                      🤖
                    </div>
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Quick Suggestions */}
            {showSuggestions && suggestions.length > 0 && messages.length <= 1 && (
              <div className="space-y-3">
                {suggestions.map((category, idx) => (
                  <div key={idx} className="bg-white rounded-lg p-3 border border-gray-200">
                    <h4 className="text-sm font-medium text-gray-700 mb-2">
                      {category.category}
                    </h4>
                    <div className="grid grid-cols-1 gap-1">
                      {category.questions.map((question: string, qIdx: number) => (
                        <button
                          key={qIdx}
                          onClick={() => handleSuggestionClick(question)}
                          className="text-xs text-left p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        >
                          {question}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-2xl">
            <div className="flex items-end space-x-2">
              <div className="flex-1">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask me anything about Trek Tribe..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm resize-none"
                  disabled={isLoading}
                />
              </div>
              <button
                onClick={() => sendMessage(inputMessage)}
                disabled={isLoading || !inputMessage.trim()}
                className="p-2 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg hover:from-green-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <div className="text-xs text-gray-500 mt-1 text-center">
              Press Enter to send • Powered by Trek Tribe AI
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotPopup;