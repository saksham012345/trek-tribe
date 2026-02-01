import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
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
  const location = useLocation();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [isOpen, setIsOpen] = useState(false);

  // Load messages from localStorage on component mount
  // Load messages from localStorage on component mount
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        // Use user-specific key if available, otherwise guest
        // Note: user might be null on first render if auth is loading, so we might start with guest
        // and then switch in useEffect
        const key = `chatMessages_${user?.id || 'guest'}`;
        const savedMessages = localStorage.getItem(key);
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
        const key = `chatMessages_${user?.id || 'guest'}`;
        localStorage.setItem(key, JSON.stringify(messages));
      } catch (e) {
        console.error('Error saving chat messages to localStorage:', e);
      }
    }
  }, [messages, user?.id]);

  // Reload messages when user changes (e.g. login/logout)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const key = `chatMessages_${user?.id || 'guest'}`;
        const savedMessages = localStorage.getItem(key);
        setMessages(savedMessages ? JSON.parse(savedMessages) : []);
      } catch (e) {
        console.error('Error switching chat history:', e);
        setMessages([]);
      }
    }
  }, [user?.id]);

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

  const handleLocalGreetings = (text: string): boolean => {
    const greetings = ['hi', 'hello', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening'];
    const lowerText = text.trim().toLowerCase();

    if (greetings.includes(lowerText)) {
      const responses = [
        `Hello ${user?.name || 'there'}! 👋 How can I help you plan your next adventure today?`,
        `Hi! I'm here to help with trips, bookings, or any questions you have about Trek Tribe.`,
        `Hey there! Looking for a getaway? Ask me about our latest treks!`
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];

      const msg: ChatMessage = {
        id: `greet_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: randomResponse,
        timestamp: new Date()
      };

      // Delay slightly for natural feel
      setTimeout(() => {
        setMessages((s) => [...s, msg]);
        setIsLoading(false);
      }, 500);
      return true;
    }
    return false;
  };

  const formatRecommendations = (recs: any[]) => {
    if (!recs || recs.length === 0) {
      return 'No recommendations available right now. Tell me your preferred dates, budget, and destination so I can tailor options.';
    }

    const header = '🌟 **Top Picks for You:**\n';
    const items = recs.slice(0, 5).map((r: any, idx: number) => {
      const name = r.title || r.name || r.trip || `Option ${idx + 1}`;
      const place = r.destination || r.location || r.region || '';
      const price = r.price || r.cost || r.fare ? `₹${r.price || r.cost || r.fare}` : '';
      const rating = r.averageRating ? `⭐ ${r.averageRating}` : '';

      // Clean formatted line
      return `${idx + 1}. **${name}** ${place ? `(${place})` : ''} \n   ${price} ${rating ? `• ${rating}` : ''}`;
    });

    return header + items.join('\n\n');
  };

  const formatAvailability = (trips: any[]) => {
    if (!trips || trips.length === 0) {
      return '📅 **Availability Check**\n\nNo upcoming trips found matching your criteria. Try adjusting your dates or destination preferences.';
    }

    const lines: string[] = ['📅 **Upcoming Trips:**\n'];

    trips.slice(0, 8).forEach((t: any) => {
      const start = t.startDate ? new Date(t.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'TBD';
      const dest = t.destination || 'Unknown';
      const title = t.title || 'Trip';
      const price = t.price ? `₹${t.price}` : '';
      const spotsLeft = typeof t.capacity === 'number' && Array.isArray(t.participants)
        ? Math.max(t.capacity - t.participants.length, 0)
        : null;

      lines.push(`• **${title}** in ${dest}\n   📅 ${start} • ${price} ${spotsLeft !== null ? `• ${spotsLeft} spots left` : ''}`);
    });

    lines.push('\n💡 *Tip: Click "Get Recommendations" for personalized suggestions!*');
    return lines.join('\n\n');
  };

  const formatAnalytics = (data: any) => {
    if (!data || Object.keys(data).length === 0) {
      return '📊 **Analytics Dashboard**\n\nNo data available yet. Start your journey to see your travel stats!';
    }

    const overview = data.overview || data;
    const isOrganizer = user?.role === 'organizer';

    let report = `📊 **Analytics Overview**\n\n`;

    if (isOrganizer) {
      // Organizer specific stats
      const revenue = overview.revenue || overview.totalRevenue || 0;
      const totalTrips = overview.trips || overview.totalTrips || 0;
      const bookings = overview.bookings || overview.totalBookings || 0;
      const rating = overview.averageRating || 'N/A';
      const conversion = overview.conversionRate ? `${overview.conversionRate}%` : 'N/A';

      report += `💰 **Total Revenue:** ₹${revenue.toLocaleString()}\n`;
      report += `🏔️ **Trips Organized:** ${totalTrips}\n`;
      report += `🎫 **Total Bookings:** ${bookings}\n`;
      report += `⭐ **Average Rating:** ${rating}\n`;
      report += `📈 **Conversion Rate:** ${conversion}\n`;

      if (overview.topDestinations && overview.topDestinations.length) {
        report += `\n🏆 **Top Destinations:**\n${overview.topDestinations.slice(0, 3).map((d: string) => `• ${d}`).join('\n')}`;
      }
    } else {
      // Traveler stats
      const tripsJoined = overview.tripsJoined || overview.completedTrips || 0;
      const upcoming = overview.upcomingTrips || overview.upcoming || 0;
      const wishlist = overview.wishlistCount || 0;

      report += `🎒 **Trips Joined:** ${tripsJoined}\n`;
      report += `🔜 **Upcoming Adventures:** ${upcoming}\n`;
      report += `❤️ **Wishlisted Items:** ${wishlist}\n`;

      if (upcoming > 0) {
        report += `\nGet ready for your next adventure! Check your profile for packing lists.`;
      }
    }

    return report;
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

      const msgText = upcoming.length > 0
        ? formatAvailability(upcoming)
        : `📅 **Availability Check**\n\nNo trips available at **${p.destination || 'your selected destination'}** matching your criteria.\n\nTry adjusting your dates or budget to see more options.`;

      const msg: ChatMessage = { id: `avail_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: msgText, timestamp: new Date() };
      setMessages((s) => [...s, msg]);
      setShowPreferenceModal(false);
    } catch (e: any) {
      console.error('Search error:', e);
      // Fallback for actual errors
      const err: ChatMessage = { id: `availerr_${Date.now()}`, senderId: 'system', senderName: 'System', senderRole: 'ai', message: 'Unable to fetch availability right now. Please try again later.', timestamp: new Date() };
      setMessages((s) => [...s, err]);
      setShowPreferenceModal(false); // Close modal even on error
    }
    setActionLoading(null);
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
        // Ensure message content is a string, not object
        let content = msg.message || String(msg);
        if (typeof content === 'object') {
          content = JSON.stringify(content, null, 2);
          // Attempt to pretty print if it's still an object, but we aim for text
        }

        const chatMsg: ChatMessage = {
          id: msg.id || `m_${Date.now()}`,
          senderId: msg.senderId || 'ai',
          senderName: msg.senderName || (msg.senderRole === 'user' ? 'You' : 'Assistant'),
          senderRole: msg.senderRole || 'ai',
          message: content,
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
      // Use the AI chat endpoint which handles conversation context
      const resp = await api.post('/api/ai/chat', {
        message: text,
        context: {
          userId: user?.id,
          userRole: user?.role,
          sessionId: socketRef.current?.id || `session_${Date.now()}`,
          currentPath: location.pathname,
          pageTitle: document.title
        }
      });
      const data = resp.data || {};
      // Handle different response formats from AI service
      let aiText = (data && (
        (data as any).message ||
        (data as any).response ||
        (data as any).text ||
        (data as any).content ||
        data
      ));

      if (typeof aiText === 'object') {
        // Fallback: if backend sends JSON, format it simply
        aiText = JSON.stringify(aiText, null, 2).replace(/[{}""]/g, '');
      } else {
        aiText = String(aiText || '');
      }

      // Check if response indicates low confidence or requires human agent
      const requiresHuman = (data as any).requiresHumanAgent === true ||
        (data as any).confidence === 'low' ||
        aiText.toLowerCase().includes('i\'m not sure');

      const chatMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        senderId: 'ai',
        senderName: 'Trek Tribe Assistant',
        senderRole: 'ai',
        message: aiText,
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
          const lastUserMessage = (() => {
            const userMessages = messages.filter(m => m.senderRole === 'user');
            return userMessages.length ? userMessages[userMessages.length - 1].message : undefined;
          })();

          const subject = (data as any).actions?.ticket_summary ||
            (isSensitive ? `Sensitive inquiry: ${text.substring(0, 80)}...` :
              text.length > 100 ? text.slice(0, 100) + '...' : text);
          const description = `User asked: ${lastUserMessage || text}\n\nReason: ${requiresHuman ? 'Low AI confidence' :
            isSensitive ? 'Sensitive topic (refund/cancellation/complaint)' :
              'AI suggested human assistance'
            }\n\nAssistant response:\n${aiText}`;

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
              `🎫 **Support Ticket Created**\nTicket ID: **${ticketData.ticketId}**\n\n${isSensitive ? 'Due to the nature of your request, ' : ''}A human agent will review this and assist you shortly.` :
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

    // Safety timeout to prevent infinite loading
    const loadingTimeout = setTimeout(() => {
      setIsLoading((loading) => {
        if (loading) {
          console.warn('AI Chat request timed out');
          const timeoutMsg: ChatMessage = {
            id: `timeout_${Date.now()}`,
            senderId: 'system',
            senderName: 'System',
            senderRole: 'ai',
            message: 'Response is taking longer than usual. You can try resending or check your connection.',
            timestamp: new Date(),
          };
          setMessages((s) => [...s, timeoutMsg]);
          return false;
        }
        return loading;
      });
    }, 15000); // 15s timeout

    try {
      // Check for local greetings first
      if (handleLocalGreetings(text)) {
        clearTimeout(loadingTimeout);
        return; // Handled locally
      }

      if (socketRef.current && socketRef.current.connected && !socketFailed) {
        try {
          socketRef.current.emit('ai_chat_message', {
            message: text,
            context: {
              currentPath: location.pathname,
              userRole: user?.role
            }
          });
          // Note: isLoading is set to false in the 'chat_message' socket listener
        } catch (e) {
          await sendMessageToAIProxy(text);
        }
      } else {
        await sendMessageToAIProxy(text);
      }
    } catch (err) {
      console.error('Error in sendMessage:', err);
      setIsLoading(false);
    } finally {
      // If we're not using the socket (which handles its own isLoading), clear the timeout
      // Actually sendMessageToAIProxy already handles setIsLoading(false)
      // If we ARE using socket, we let the timeout or the listener handle it
      if (!(socketRef.current && socketRef.current.connected && !socketFailed)) {
        clearTimeout(loadingTimeout);
      }
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

      const lastUserMessage = (() => {
        const userMessages = messages.filter(m => m.senderRole === 'user');
        return userMessages.length ? userMessages[userMessages.length - 1].message : undefined;
      })();
      const description = inputMessage || lastUserMessage || 'User requested to speak with a human agent';

      // Create support ticket for human agent
      // The endpoint expects: message, category (optional), priority (optional)
      const resp = await api.post('/api/support/human-agent/request', {
        message: description,
        category: 'general',
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

  // Typing indicator simulation
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setIsTyping(true);
    } else {
      // Add a small delay before removing typing indicator for realism
      const timer = setTimeout(() => setIsTyping(false), 800);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  return (
    <div className="chat-widget-container font-sans">
      {/* Toggle when closed */}
      {!isOpen && (
        <div className="chat-widget-toggle group" onClick={() => setIsOpen(true)} title="Open Trek Tribe Assistant">
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-400 to-teal-600 rounded-full animate-pulse opacity-75"></div>
          <div className="relative bg-white text-emerald-600 rounded-full p-3 shadow-lg group-hover:scale-110 transition-transform duration-300">
            <svg className="w-8 h-8" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </div>
        </div>
      )}

      {/* Full widget */}
      {isOpen && (
        <div className="chat-widget glass-panel">
          <div className="chat-header glass-header">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-100 to-white flex items-center justify-center border border-white/50 shadow-sm">
                  <span className="text-xl">🤖</span>
                </div>
                <div className={`absolute bottom-0 right-0 w-3 h-3 border-2 border-white rounded-full ${socketFailed ? 'bg-red-400' : 'bg-emerald-400'}`}></div>
              </div>
              <div className="chat-header-info">
                <h3 className="font-bold text-gray-800 text-lg">TrekTribe AI</h3>
                <p className="text-xs text-emerald-600 font-medium">{socketFailed ? 'Offline' : 'Online & Ready to Help'}</p>
                <p className="text-[10px] text-orange-500 font-medium mt-1">⚠️ Feature in Beta: Not fully functional</p>
              </div>
            </div>
            <button className="chat-close-btn hover:rotate-90 transition-transform duration-300" onClick={() => setIsOpen(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="chat-messages scrollbar-thin scrollbar-thumb-emerald-200 scrollbar-track-transparent">
            {messages.map((m) => (
              <div key={m.id} className={`message-wrapper ${m.senderRole === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.senderRole !== 'user' && (
                  <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-xs mr-2 border border-gray-200">
                    {m.senderRole === 'ai' ? '🤖' : '👤'}
                  </div>
                )}
                <div className={`message-bubble ${m.senderRole === 'user' ? 'user-bubble' : 'ai-bubble glass-bubble'}`}>
                  {m.senderRole !== 'user' && <div className="text-[10px] font-bold text-emerald-700/60 mb-1 uppercase tracking-wider">{m.senderName}</div>}
                  <div className="message-text markdown-body" style={{ whiteSpace: 'pre-wrap' }}>{m.message}</div>
                  <div className="text-[10px] opacity-50 mt-1 text-right">{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="message-wrapper justify-start">
                <div className="w-8 h-8 rounded-full bg-gray-100 flex-shrink-0 flex items-center justify-center text-xs mr-2">🤖</div>
                <div className="bg-white/80 border border-gray-100 rounded-2xl py-3 px-4 shadow-sm backdrop-blur-sm">
                  <div className="typing-indicator">
                    <span></span><span></span><span></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Action grid */}
          <div className="bg-white/80 backdrop-blur-md border-t border-gray-100 p-3">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none mb-2">
              {[
                {
                  l: '🚀 Recommendations', a: async () => { /* reuse existing logic */
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
                  }
                },
                { l: '📅 Availability', a: () => setShowPreferenceModal(true) },
                {
                  l: '📊 My Stats', a: async () => { /* reuse analytics logic */
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
                  }
                },
                { l: '🧑‍💼 Human Agent', a: requestHumanAgent }
              ].map((btn, i) => (
                <button key={i} onClick={btn.a} className="whitespace-nowrap px-3 py-1.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full hover:bg-emerald-100 transition-colors border border-emerald-100 shadow-sm">
                  {btn.l}
                </button>
              ))}
            </div>

            <div className="chat-input-wrapper glass-input-wrapper">
              <input
                className="chat-input bg-transparent"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                placeholder="Ask me anything..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                disabled={isLoading}
              />
              <button
                className={`send-button ${inputMessage.trim() ? 'opacity-100 translate-y-0' : 'opacity-40 translate-y-2'} transition-all duration-200`}
                onClick={sendMessage}
                disabled={isLoading}
              >
                <div className="w-8 h-8 bg-gradient-to-tr from-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-white shadow-md hover:shadow-lg">
                  <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </div>
              </button>
            </div>

            {/* If a ticket was created in this session, allow quick AI resolution */}
            {currentTicketId && (
              <div className="mt-2 text-center">
                <button
                  className="text-xs text-indigo-600 hover:underline font-medium"
                  onClick={() => fetchAISuggestionForTicket(currentTicketId)}
                  disabled={aiResolveLoading || showPreview}
                >
                  {aiResolveLoading ? 'Thinking...' : `✨ Preview resolution for ticket #${currentTicketId}`}
                </button>

                {/* Preview area: show suggestion and confirm/cancel */}
                {showPreview && (
                  <div className="absolute bottom-20 left-4 right-4 bg-white/95 backdrop-blur-xl border border-indigo-100 rounded-xl shadow-2xl p-4 z-20 animate-slide-up">
                    <h4 className="text-xs font-bold text-indigo-900 mb-2 uppercase tracking-wide flex items-center gap-2">
                      <span>✨</span> AI Suggested Resolution
                    </h4>
                    <div className="text-sm text-gray-700 max-h-32 overflow-y-auto mb-3 p-2 bg-indigo-50/50 rounded border border-indigo-100">{previewSuggestion}</div>
                    <div className="flex gap-2 justify-end">
                      <button
                        className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded hover:bg-gray-200"
                        onClick={() => { setShowPreview(false); setPreviewSuggestion(null); }}
                        disabled={aiResolveLoading}
                      >
                        Cancel
                      </button>
                      <button
                        className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded shadow-sm hover:bg-indigo-700"
                        onClick={() => confirmResolve(currentTicketId)}
                        disabled={aiResolveLoading}
                      >
                        {aiResolveLoading ? 'Applying...' : 'Apply Fix'}
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
