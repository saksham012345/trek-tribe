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
}

const AIChatWidgetClean: React.FC = () => {
  const { user } = useAuth();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [socketFailed, setSocketFailed] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const API_BASE_URL = process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_API_URL || '';

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
      const fallback: ChatMessage = {
        id: `err_${Date.now()}`,
        senderId: 'system',
        senderName: 'System',
        senderRole: 'ai',
        message: 'AI service unavailable. Please try again later.',
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

  return (
    <div className="ai-chat-widget">
      <div className="ai-header" onClick={() => setIsOpen((v) => !v)}>
        <strong>Trek Tribe Assistant</strong>
      </div>

      {isOpen && (
        <div className="ai-body">
          <div className="ai-messages">
            {messages.map((m) => (
              <div key={m.id} className={`ai-message ${m.senderRole === 'user' ? 'user' : 'ai'}`}>
                <div className="ai-message-sender">{m.senderRole === 'user' ? 'You' : m.senderName}</div>
                <div className="ai-message-text">{m.message}</div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <div className="ai-input-row">
            <input
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
            <button onClick={sendMessage} disabled={isLoading}>{isLoading ? '...' : 'Send'}</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIChatWidgetClean;
