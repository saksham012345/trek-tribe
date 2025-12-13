import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';
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
}

const AIChatWidgetClean: React.FC = () => {
  const { user } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [isOpen, setIsOpen] = useState(false);
  
  // Load messages from localStorage on component mount
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedMessages = localStorage.getItem('chatMessages');
        return savedMessages ? JSON.parse(savedMessages) : [];
      } catch (e) {
        console.error('Error loading chat messages from localStorage:', e);
        return [];
      }
    }
    return [];
  });
  
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socketFailed, setSocketFailed] = useState(false);
  const [currentTicketId, setCurrentTicketId] = useState<string | null>(null);
  const [aiResolveLoading, setAiResolveLoading] = useState(false);
  const [previewSuggestion, setPreviewSuggestion] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const socketRef = useRef<any | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const API_BASE_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_URL || '';

  // Save messages to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('chatMessages', JSON.stringify(messages));
      } catch (e) {
        console.error('Error saving chat messages to localStorage:', e);
      }
    }
  }, [messages]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, token]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    if (messagesEndRef.current) messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeSocket = () => {
    try {
      const socketUrl = API_BASE_URL.replace('/api', '') || window.location.origin;
      socketRef.current = io(socketUrl, {
        auth: { token: token || undefined },
        path: '/socket.io/',
        transports: ['websocket', 'polling'],
        timeout: 20000,
      });

      const socket = socketRef.current;
      socket.on('connect', () => {
        setSocketFailed(false);
      });

      socket.on('chat_message', (msg: any) => {
        const chatMsg: ChatMessage = {
          id: msg.id || `m_${Date.now()}`,
          senderId: msg.senderId || 'ai',
          senderName: msg.senderName || (msg.senderRole === 'user' ? 'You' : 'Assistant'),
          senderRole: msg.senderRole || 'ai',
          message: msg.message || String(msg),
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
        };
        setMessages((s) => [...s, chatMsg]);
        setIsLoading(false);
      });

      socket.on('connect_error', () => {
        setSocketFailed(true);
        setIsLoading(false);
      });
    } catch (e) {
      setSocketFailed(true);
    }
  };

  const sendMessageToAIProxy = async (text: string) => {
    try {
      const resp = await api.post('/api/ai/generate', { prompt: text, max_tokens: 256 });
      const data = resp.data || {};
      const aiText = (data && ((data as any).text ?? data)) || JSON.stringify(data);
      const chatMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: typeof aiText === 'string' ? aiText : JSON.stringify(aiText),
        timestamp: new Date(),
      };
      setMessages((s) => [...s, chatMsg]);

      // If AI indicates a ticket should be created, call support endpoint
      try {
        const actions = (data && (data as any).actions) || null;
        if (actions && actions.create_ticket) {
          // Build ticket payload: prefer assistant-provided summary, fall back to user text
          const subject = actions.ticket_summary || (text.length > 100 ? text.slice(0, 100) + '...' : text);
          const description = `User asked: ${text}\n\nAssistant suggested creating a ticket.\nAssistant text:\n${typeof aiText === 'string' ? aiText : JSON.stringify(aiText)}`;

          try {
            const ticketResp = await api.post('/api/support/tickets', {
              subject,
              description,
              category: 'ai-assist',
              priority: 'medium'
            });

            const ticketData = ticketResp.data?.ticket;
            const systemMsg: ChatMessage = {
              id: `sys_${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderRole: 'ai',
              message: ticketData ? `Support ticket created (ID: ${ticketData.ticketId}). An agent will follow up.` : 'Support ticket requested; failed to create automatically.',
              timestamp: new Date(),
            };
              setMessages((s) => [...s, systemMsg]);
              // remember created ticket id for quick AI resolution actions
              if (ticketData && ticketData.ticketId) setCurrentTicketId(ticketData.ticketId);
          } catch (err) {
            const sysErr: ChatMessage = {
              id: `syserr_${Date.now()}`,
              senderId: 'system',
              senderName: 'System',
              senderRole: 'ai',
              message: 'AI suggested creating a support ticket, but automatic creation failed. Please try again or contact support.',
              timestamp: new Date(),
            };
            setMessages((s) => [...s, sysErr]);
          }
        }
      } catch (e) {
        // Non-fatal: don't break chat flow
      }
    } catch (err: any) {
      // If AI proxy unavailable, provide a lightweight local fallback so widget remains useful
      const localReply = (() => {
        const t = text.toLowerCase();
        if (t.includes('booking') || t.includes('book')) {
          return 'I can help with bookings — tell me which trip or dates you are interested in, and I will check availability or create a booking request.';
        }
        if (t.includes('payment') || t.includes('refund')) {
          return 'For payment issues, please share the booking ID or transaction details. I can guide you through refund and payment verification steps.';
        }
        if (t.includes('cancel') || t.includes('cancellation')) {
          return 'To cancel a booking, please provide the booking ID. I will check the cancellation policy and next steps.';
        }
        // Generic helpful fallback
        return "I'm temporarily offline for advanced suggestions, but I can still help: please describe your issue in a bit more detail and I'll provide step-by-step guidance.";
      })();

      const fallback: ChatMessage = {
        id: `err_${Date.now()}`,
        senderId: 'system',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: localReply,
        timestamp: new Date(),
      };
      setMessages((s) => [...s, fallback]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = inputMessage.trim();
    if (!text) return;
    setInputMessage('');
    setIsLoading(true);

    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      senderId: user?.id || 'guest',
      senderName: user?.name || 'You',
      senderRole: 'user',
      message: text,
      timestamp: new Date(),
    };
    setMessages((s) => [...s, userMsg]);

    if (socketRef.current && socketRef.current.connected && !socketFailed) {
      try {
        socketRef.current.emit('ai_chat_message', { message: text, context: {} });
      } catch (e) {
        await sendMessageToAIProxy(text);
      }
    } else {
      await sendMessageToAIProxy(text);
    }
  };

  // Request AI suggestion for an existing ticket and show preview (manual confirm)
  const fetchAISuggestionForTicket = async (ticketId: string) => {
    try {
      setAiResolveLoading(true);
      setPreviewSuggestion(null);
      setShowPreview(false);

      const aiResp = await api.post(`/api/support/tickets/${encodeURIComponent(ticketId)}/ai-resolve`);
      const suggestion = aiResp.data?.suggestion || aiResp.data?.suggestionText || (aiResp.data?.aiRaw ? JSON.stringify(aiResp.data.aiRaw) : null) || 'No suggestion available';

      // Show preview to the user for confirmation
      setPreviewSuggestion(typeof suggestion === 'string' ? suggestion : JSON.stringify(suggestion));
      setShowPreview(true);
    } catch (err: any) {
      const errMsg: ChatMessage = {
        id: `aierr_${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'ai',
        message: 'AI suggestion failed. Try again later.',
        timestamp: new Date(),
      };
      setMessages((s) => [...s, errMsg]);
    } finally {
      setAiResolveLoading(false);
    }
  };

  // Confirm and apply resolution previously previewed
  const confirmResolve = async (ticketId: string) => {
    if (!previewSuggestion) return;
    try {
      setAiResolveLoading(true);
      const res = await api.post(`/api/support/tickets/${encodeURIComponent(ticketId)}/resolve`, { resolutionNote: previewSuggestion });
      const confirmation: ChatMessage = {
        id: `conf_${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'ai',
        message: res.data?.message || `Ticket ${ticketId} resolved via assistant.`,
        timestamp: new Date(),
      };
      setMessages((s) => [...s, confirmation]);
      setCurrentTicketId(null);
      setPreviewSuggestion(null);
      setShowPreview(false);
    } catch (err: any) {
      const confErr: ChatMessage = {
        id: `conferr_${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'ai',
        message: 'Failed to apply resolution to the ticket. Please try again or contact support.',
        timestamp: new Date(),
      };
      setMessages((s) => [...s, confErr]);
    } finally {
      setAiResolveLoading(false);
    }
  };

  // Request human agent assistance
  const requestHumanAgent = async () => {
    if (!user) {
      const loginMsg: ChatMessage = {
        id: `login_${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'ai',
        message: 'Please log in to request human agent assistance.',
        timestamp: new Date(),
      };
      setMessages((s) => [...s, loginMsg]);
      return;
    }

    try {
      setIsLoading(true);
      
      // Create support ticket for human agent
      const resp = await api.post('/api/support/human-agent/request', {
        message: inputMessage || 'User requested to speak with a human agent',
        category: 'chat_request',
        priority: 'medium'
      });

      if (resp.data?.success) {
        const ticketId = resp.data?.ticket?.ticketId;
        setCurrentTicketId(ticketId);

        const systemMsg: ChatMessage = {
          id: `agent_${Date.now()}`,
          senderId: 'system',
          senderName: 'Trek Tribe Support',
          senderRole: 'ai',
          message: `✅ Human agent support ticket created (ID: ${ticketId}). A support agent will be with you shortly. They will help you with any issues or questions you have.`,
          timestamp: new Date(),
        };
        
        setMessages((s) => [...s, systemMsg]);
        setInputMessage('');

        // Optional: show available agents
        try {
          const agentsResp = await api.get('/api/support/agents/available');
          if (agentsResp.data?.agents?.length > 0) {
            const agentMsg: ChatMessage = {
              id: `agents_${Date.now()}`,
              senderId: 'system',
              senderName: 'Trek Tribe Support',
              senderRole: 'ai',
              message: `Available agents online: ${agentsResp.data.agents.slice(0, 3).map((a: any) => a.name).join(', ')}. They will respond shortly.`,
              timestamp: new Date(),
            };
            setMessages((s) => [...s, agentMsg]);
          }
        } catch (e) {
          // Silently fail, don't block user
        }
      } else {
        const errMsg: ChatMessage = {
          id: `agerr_${Date.now()}`,
          senderId: 'system',
          senderName: 'System',
          senderRole: 'ai',
          message: 'Failed to create support ticket. Please try again.',
          timestamp: new Date(),
        };
        setMessages((s) => [...s, errMsg]);
      }
    } catch (error: any) {
      const errMsg: ChatMessage = {
        id: `agerr2_${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'ai',
        message: `Error: ${error.message || 'Failed to request human agent'}`,
        timestamp: new Date(),
      };
      setMessages((s) => [...s, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="chat-widget-container">
      {/* Toggle when closed */}
      {!isOpen && (
        <div className="chat-widget-toggle" onClick={() => setIsOpen(true)} title="Open Trek Tribe Assistant">
          <svg className="chat-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" width={24} height={24}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
      )}

      {/* Full widget */}
      {isOpen && (
        <div className="chat-widget">
          <div className="chat-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 10, height: 10, borderRadius: 10, background: '#34D399', boxShadow: '0 0 0 4px rgba(52,211,153,0.08)' }} />
              <div className="chat-header-info">
                <h3 style={{ margin: 0 }}>Trek Tribe Support</h3>
                <div className={`connection-status ${socketFailed ? 'disconnected' : 'connected'}`} style={{ marginTop: 2 }}>{socketFailed ? 'Offline' : 'Online'}</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button className="chat-close-btn" onClick={() => setIsOpen(false)}>×</button>
            </div>
          </div>

          <div className="chat-messages">
            {messages.map((m) => (
              <div key={m.id} className={`message ${m.senderRole === 'user' ? 'user' : m.senderRole === 'ai' ? 'assistant ai' : 'agent'}`}>
                <div className="message-header">
                  <div className="message-sender">{m.senderRole === 'user' ? 'You' : m.senderName}</div>
                  <div className="message-timestamp">{new Date(m.timestamp).toLocaleString()}</div>
                </div>
                <div className="message-content">{m.message}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Action grid (large buttons as in screenshot) */}
          <div className="chat-footer" style={{ padding: '12px' }}>
            <div className="smart-actions-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <button className="smart-action-btn" onClick={async () => {
                // Get Recommendations
                try {
                  const resp = await api.get('/api/ai/recommendations');
                  const recs = resp.data?.recommendations || resp.data || [];
                  const msg: ChatMessage = { id: `rec_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: `Recommendations:\n${JSON.stringify(recs, null, 2)}`, timestamp: new Date() };
                  setMessages(s => [...s, msg]);
                } catch (e: any) {
                  const err: ChatMessage = { id: `recerr_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: 'Failed to fetch recommendations.', timestamp: new Date() };
                  setMessages(s => [...s, err]);
                }
              }}>🚀 Get Recommendations</button>

              <button className="smart-action-btn" onClick={() => {
                // Check Availability: simple prompt to AI chat
                setInputMessage('Check availability for upcoming trips from my location');
              }}>📅 Check Availability</button>

              <button className="smart-action-btn" onClick={async () => {
                try {
                  const resp = await api.get('/api/analytics/dashboard');
                  const data = resp.data || resp.data?.overview || {};
                  const msg: ChatMessage = { id: `an_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: `My Analytics:\n${JSON.stringify(data, null, 2)}`, timestamp: new Date() };
                  setMessages(s => [...s, msg]);
                } catch (e: any) {
                  const demoData = { overview: { tripsJoined: 0, upcomingTrips: 0, openTickets: 0 }, note: 'Demo analytics shown — sign up as an organizer to see detailed metrics.' };
                  const msg: ChatMessage = { id: `andemo_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: `My Analytics (demo):\n${JSON.stringify(demoData, null, 2)}`, timestamp: new Date() };
                  setMessages(s => [...s, msg]);
                }
              }}>📊 My Analytics</button>

              <button className="smart-action-btn" onClick={() => { setInputMessage('I need help with booking a trip'); }}>{'🧭 Booking Help'}</button>
            </div>

            <div style={{ marginTop: 8 }}>
              <button className="human-agent-request-btn" onClick={requestHumanAgent} disabled={isLoading}>
                {isLoading ? '⏳ Requesting Agent...' : '🧑‍💼 Talk to a Human Agent'}
              </button>
            </div>
          </div>

          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <input
                className="chat-input"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask a question..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={isLoading}
              />
              <button className="send-button" onClick={sendMessage} disabled={isLoading}>{isLoading ? '...' : '›'}</button>
            </div>
            {/* If a ticket was created in this session, allow quick AI resolution */}
            {currentTicketId && (
              <div className="mt-2 px-3">
                <button
                  className="resolve-ai-button px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
                  onClick={() => fetchAISuggestionForTicket(currentTicketId)}
                  disabled={aiResolveLoading || showPreview}
                >
                  {aiResolveLoading ? 'Fetching suggestion...' : `Preview AI resolution for ${currentTicketId}`}
                </button>

                {/* Preview area: show suggestion and confirm/cancel */}
                {showPreview && (
                  <div className="mt-3 p-3 bg-white border rounded shadow-sm">
                    <div className="mb-2 text-sm text-gray-600">User: <strong>{user?.name || 'Guest'}</strong></div>
                    <h4 className="text-sm font-medium mb-1">AI Suggested Resolution (preview)</h4>
                    <div className="mb-3 text-sm text-gray-800 whitespace-pre-wrap">{previewSuggestion}</div>
                    <div className="flex space-x-2">
                      <button
                        className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                        onClick={() => confirmResolve(currentTicketId)}
                        disabled={aiResolveLoading}
                      >
                        {aiResolveLoading ? 'Applying...' : 'Confirm & Apply'}
                      </button>
                      <button
                        className="px-3 py-2 bg-gray-100 rounded"
                        onClick={() => { setShowPreview(false); setPreviewSuggestion(null); }}
                        disabled={aiResolveLoading}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatWidgetClean;
