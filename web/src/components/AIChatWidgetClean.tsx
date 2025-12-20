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
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPreferenceModal, setShowPreferenceModal] = useState(false);
  const [preferences, setPreferences] = useState({
    destination: '',
    tripType: 'all',
    minPrice: '',
    maxPrice: '',
    daysAhead: '30'
  });

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

  const formatRecommendations = (recs: any[]) => {
    if (!recs || recs.length === 0) {
      return 'No recommendations available right now. Tell me your preferred dates, budget, and destination so I can tailor options.';
    }

    return ['Here are some picks:', ...recs.slice(0, 5).map((r: any, idx: number) => {
      const name = r.title || r.name || r.trip || `Option ${idx + 1}`;
      const place = r.destination || r.location || r.region || '';
      const price = r.price || r.cost || r.fare || '';
      const note = r.description || r.summary || '';
      const parts = [name, place && `(${place})`, price && `~ ${price}`, note].filter(Boolean);
      return `${idx + 1}. ${parts.join(' - ')}`;
    })].join('\n');
  };

  const formatAvailability = (trips: any[]) => {
    if (!trips || trips.length === 0) {
      return 'No upcoming availability found for your criteria. Try adjusting dates, destination, or trip type.';
    }

    const lines: string[] = [];
    lines.push('Upcoming availability by trip:');
    const now = new Date();

    trips.slice(0, 10).forEach((t: any, idx: number) => {
      const start = t.startDate ? new Date(t.startDate) : null;
      const dateStr = start ? start.toLocaleDateString() : 'TBD';
      const dest = t.destination || 'Unknown';
      const title = t.title || `Trip ${idx + 1}`;
      const price = t.price ? `₹${t.price}` : '';
      const capacity = typeof t.capacity === 'number' ? t.capacity : undefined;
      const participants = Array.isArray(t.participants) ? t.participants.length : 0;
      const spotsLeft = capacity !== undefined ? Math.max(capacity - participants, 0) : undefined;
      const spotsStr = spotsLeft !== undefined ? `${spotsLeft} spots left` : 'Spots info unavailable';
      const cat = Array.isArray(t.categories) && t.categories.length ? ` • ${t.categories[0]}` : '';
      lines.push(`• ${title} (${dest})${cat} — ${dateStr} — ${spotsStr}${price ? ` — ${price}` : ''}`);
    });

    lines.push('\nTell me your preferences (destination, dates, budget, type) to refine availability.');
    return lines.join('\n');
  };

  const fetchAvailabilityWithPreferences = async (prefs?: typeof preferences) => {
    const p = prefs || preferences;
    if (actionLoading) return;
    setActionLoading('availability');
    try {
      const today = new Date();
      const daysAhead = parseInt(p.daysAhead, 10) || 90;
      const toDate = new Date(today.getTime() + daysAhead * 24 * 60 * 60 * 1000);
      const params: Record<string, string> = {
        from: today.toISOString(),
        to: toDate.toISOString(),
        limit: '50'
      };

      if (p.destination) {
        params.dest = p.destination;
      } else if (user?.location) {
        params.dest = user.location;
      }

      if (p.minPrice) {
        params.minPrice = p.minPrice;
      }
      if (p.maxPrice) {
        params.maxPrice = p.maxPrice;
      }
      if (p.tripType && p.tripType !== 'all') {
        params.category = p.tripType;
      }

      const query = new URLSearchParams(params).toString();
      const resp = await api.get(`/api/trips?${query}`);
      const trips = Array.isArray(resp.data) ? resp.data : [];
      const upcoming = trips.filter((t: any) => {
        try {
          return new Date(t.startDate) >= today;
        } catch {
          return true;
        }
      });

      const msgText = formatAvailability(upcoming);
      const msg: ChatMessage = { id: `avail_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: msgText, timestamp: new Date() };
      setMessages((s) => [...s, msg]);
      setShowPreferenceModal(false);
    } catch (e: any) {
      const err: ChatMessage = { id: `availerr_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: 'Unable to fetch availability right now. Please try again later or specify your destination and dates.', timestamp: new Date() };
      setMessages((s) => [...s, err]);
    }
    setActionLoading(null);
  };

  const formatAnalytics = (data: any) => {
    if (!data || Object.keys(data).length === 0) {
      return 'No analytics yet. Add trips and bookings to see metrics. If you are an organizer, make sure your account is verified.';
    }

    const overview = data.overview || data;
    const trips = overview.tripsJoined ?? overview.trips ?? overview.totalTrips;
    const upcoming = overview.upcomingTrips ?? overview.upcoming;
    const openTickets = overview.openTickets ?? overview.tickets;

    return [
      'Analytics snapshot:',
      `• Trips: ${trips ?? 'N/A'}`,
      `• Upcoming: ${upcoming ?? 'N/A'}`,
      `• Open tickets: ${openTickets ?? 'N/A'}`,
      overview.revenue ? `• Revenue: ${overview.revenue}` : null,
      overview.conversionRate ? `• Conversion: ${overview.conversionRate}` : null,
      overview.topDestinations?.length ? `• Top destinations: ${overview.topDestinations.slice(0, 3).join(', ')}` : null
    ].filter(Boolean).join('\n');
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
      
      // Check if response indicates low confidence or requires human agent
      const requiresHuman = (data as any).requiresHumanAgent === true || 
                           (data as any).confidence === 'low' ||
                           (typeof aiText === 'string' && aiText.toLowerCase().includes('i\'m not sure'));
      
      const chatMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: typeof aiText === 'string' ? aiText : JSON.stringify(aiText),
        timestamp: new Date(),
      };
      setMessages((s) => [...s, chatMsg]);

      // Only create ticket if AI indicates it should OR if topic is sensitive (refund, cancellation, complaint)
      const sensitiveKeywords = ['refund', 'cancel', 'complaint', 'dispute', 'fraud', 'scam', 'unauthorized'];
      const isSensitive = sensitiveKeywords.some(kw => text.toLowerCase().includes(kw));
      
      const shouldCreateTicket = requiresHuman || 
                                 isSensitive ||
                                 ((data as any).actions && (data as any).actions.create_ticket);

      if (shouldCreateTicket) {
        try {
          const subject = (data as any).actions?.ticket_summary || 
                         (isSensitive ? `Sensitive inquiry: ${text.substring(0, 80)}...` : 
                          text.length > 100 ? text.slice(0, 100) + '...' : text);
          const description = `User asked: ${text}\n\nReason: ${
            requiresHuman ? 'Low AI confidence' : 
            isSensitive ? 'Sensitive topic (refund/cancellation/complaint)' : 
            'AI suggested human assistance'
          }\n\nAssistant response:\n${typeof aiText === 'string' ? aiText : JSON.stringify(aiText)}`;

          const ticketResp = await api.post('/api/support/tickets', {
            subject,
            description,
            category: isSensitive ? 'refund-cancellation' : 'ai-assist',
            priority: isSensitive ? 'high' : 'medium'
          });

          const ticketData = ticketResp.data?.ticket;
          const systemMsg: ChatMessage = {
            id: `sys_${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            senderRole: 'ai',
            message: ticketData ? 
              `🎫 Support ticket created (ID: ${ticketData.ticketId}). ${isSensitive ? 'Due to the sensitive nature of your request, ' : ''}A human agent will assist you shortly.` : 
              'Support ticket requested; failed to create automatically.',
            timestamp: new Date(),
          };
          setMessages((s) => [...s, systemMsg]);
          if (ticketData && ticketData.ticketId) setCurrentTicketId(ticketData.ticketId);
        } catch (err) {
          const sysErr: ChatMessage = {
            id: `syserr_${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            senderRole: 'ai',
            message: 'AI suggested creating a support ticket, but automatic creation failed. Please use the "Talk to a Human Agent" button below.',
            timestamp: new Date(),
          };
          setMessages((s) => [...s, sysErr]);
        }
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
        subject: 'Chat Support Request - Human Agent Needed',
        description: inputMessage || 'User requested to speak with a human agent',
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
          <svg className="chat-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" width={28} height={28}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V6c0-1.1-.9-2-2-2zM7 11h10M7 8h10M7 14h7" />
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
                <div className="message-content" style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Action grid (large buttons as in screenshot) */}
          <div className="chat-footer" style={{ padding: '12px' }}>
            <div className="smart-actions-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
              <button className="smart-action-btn" onClick={async () => {
                if (actionLoading) return;
                setActionLoading('recs');
                try {
                  const resp = await api.get('/api/ai/recommendations');
                  const recs = resp.data?.recommendations || resp.data || [];
                  const text = formatRecommendations(Array.isArray(recs) ? recs : [recs]);
                  const msg: ChatMessage = { id: `rec_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: text, timestamp: new Date() };
                  setMessages((s) => [...s, msg]);
                } catch (e: any) {
                  const err: ChatMessage = { id: `recerr_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: 'No recommendations available right now. Please try again or share your preferences.', timestamp: new Date() };
                  setMessages((s) => [...s, err]);
                }
                setActionLoading(null);
              }}>🚀 Get Recommendations</button>

              <button className="smart-action-btn" onClick={() => setShowPreferenceModal(true)}>📅 Check Availability</button>

              <button className="smart-action-btn" onClick={async () => {
                if (actionLoading) return;
                setActionLoading('analytics');
                try {
                  const resp = await api.get('/api/analytics/dashboard');
                  const data = resp.data || resp.data?.overview || {};
                  const msg: ChatMessage = { id: `an_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: formatAnalytics(data), timestamp: new Date() };
                  setMessages((s) => [...s, msg]);
                } catch (e: any) {
                  const fallback = formatAnalytics({ overview: { tripsJoined: 0, upcomingTrips: 0, openTickets: 0 }, note: 'Demo analytics shown — add trips to unlock live metrics.' });
                  const msg: ChatMessage = { id: `andemo_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: fallback, timestamp: new Date() };
                  setMessages((s) => [...s, msg]);
                }
                setActionLoading(null);
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

      {/* Preference Modal */}
      {showPreferenceModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold">Refine Trip Search</h3>
              <button onClick={() => setShowPreferenceModal(false)} className="text-gray-500 hover:text-gray-700">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Destination</label>
                <input
                  type="text"
                  placeholder="e.g., Himachal, Goa, Kerala"
                  value={preferences.destination}
                  onChange={(e) => setPreferences({ ...preferences, destination: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Trip Type</label>
                <select
                  value={preferences.tripType}
                  onChange={(e) => setPreferences({ ...preferences, tripType: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">All Types</option>
                  <option value="trekking">Trekking</option>
                  <option value="adventure">Adventure</option>
                  <option value="cultural">Cultural</option>
                  <option value="beach">Beach</option>
                  <option value="mountain">Mountain</option>
                  <option value="heritage">Heritage</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Min Price (₹)</label>
                  <input
                    type="number"
                    placeholder="Min"
                    value={preferences.minPrice}
                    onChange={(e) => setPreferences({ ...preferences, minPrice: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Price (₹)</label>
                  <input
                    type="number"
                    placeholder="Max"
                    value={preferences.maxPrice}
                    onChange={(e) => setPreferences({ ...preferences, maxPrice: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Search Ahead (Days)</label>
                <select
                  value={preferences.daysAhead}
                  onChange={(e) => setPreferences({ ...preferences, daysAhead: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="7">Next 7 Days</option>
                  <option value="14">Next 2 Weeks</option>
                  <option value="30">Next Month</option>
                  <option value="60">Next 2 Months</option>
                  <option value="90">Next 3 Months</option>
                </select>
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button
                onClick={() => setShowPreferenceModal(false)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => fetchAvailabilityWithPreferences()}
                disabled={actionLoading === 'availability'}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium disabled:opacity-50"
              >
                {actionLoading === 'availability' ? 'Searching...' : 'Search'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatWidgetClean;
