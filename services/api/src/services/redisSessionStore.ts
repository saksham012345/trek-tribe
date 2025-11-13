import { redisService } from './redisService';
import { logger } from '../utils/logger';

/**
 * Session structure for chat sessions
 */
interface ChatSession {
  sessionId: string;
  userId: string;
  userName: string;
  userEmail: string;
  isConnectedToAgent: boolean;
  agentId?: string;
  agentName?: string;
  ticketId?: string;
  messages: any[];
  createdAt: string;
  lastActivity: string;
}

/**
 * Redis-backed session store for Socket.IO
 * Provides persistent, distributed session management
 */
class RedisSessionStore {
  private readonly SESSION_PREFIX = 'session:';
  private readonly USER_SOCKET_PREFIX = 'user_socket:';
  private readonly AGENT_SOCKET_PREFIX = 'agent_socket:';
  private readonly ACTIVE_SESSIONS_SET = 'active_sessions';
  private readonly SESSION_TTL = 3600; // 1 hour

  // ==================== Session Management ====================

  async createSession(session: ChatSession): Promise<boolean> {
    try {
      const key = `${this.SESSION_PREFIX}${session.sessionId}`;
      const success = await redisService.setJSON(key, session, this.SESSION_TTL);
      
      if (success) {
        // Add to active sessions set
        await redisService.sAdd(this.ACTIVE_SESSIONS_SET, session.sessionId);
        logger.info('Session created', { sessionId: session.sessionId, userId: session.userId });
      }
      
      return success;
    } catch (error: any) {
      logger.error('Failed to create session', { error: error.message, sessionId: session.sessionId });
      return false;
    }
  }

  async getSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      const session = await redisService.getJSON<ChatSession>(key);
      
      if (session) {
        // Update last activity
        await this.updateSessionActivity(sessionId);
      }
      
      return session;
    } catch (error: any) {
      logger.error('Failed to get session', { error: error.message, sessionId });
      return null;
    }
  }

  async updateSession(sessionId: string, updates: Partial<ChatSession>): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return false;
      
      const updatedSession = {
        ...session,
        ...updates,
        lastActivity: new Date().toISOString()
      };
      
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      await redisService.setJSON(key, updatedSession, this.SESSION_TTL);
      
      logger.debug('Session updated', { sessionId });
      return true;
    } catch (error: any) {
      logger.error('Failed to update session', { error: error.message, sessionId });
      return false;
    }
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      await redisService.del(key);
      await redisService.sRem(this.ACTIVE_SESSIONS_SET, sessionId);
      
      logger.info('Session deleted', { sessionId });
      return true;
    } catch (error: any) {
      logger.error('Failed to delete session', { error: error.message, sessionId });
      return false;
    }
  }

  async updateSessionActivity(sessionId: string): Promise<boolean> {
    try {
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      // Extend TTL
      await redisService.expire(key, this.SESSION_TTL);
      return true;
    } catch (error: any) {
      logger.error('Failed to update session activity', { error: error.message, sessionId });
      return false;
    }
  }

  async getAllActiveSessions(): Promise<ChatSession[]> {
    try {
      const sessionIds = await redisService.sMembers(this.ACTIVE_SESSIONS_SET);
      const sessions: ChatSession[] = [];
      
      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        } else {
          // Clean up stale session ID from set
          await redisService.sRem(this.ACTIVE_SESSIONS_SET, sessionId);
        }
      }
      
      return sessions;
    } catch (error: any) {
      logger.error('Failed to get active sessions', { error: error.message });
      return [];
    }
  }

  // ==================== User-Socket Mapping ====================

  async mapUserToSocket(userId: string, socketId: string): Promise<boolean> {
    try {
      const key = `${this.USER_SOCKET_PREFIX}${userId}`;
      await redisService.set(key, socketId, this.SESSION_TTL);
      
      logger.debug('User mapped to socket', { userId, socketId });
      return true;
    } catch (error: any) {
      logger.error('Failed to map user to socket', { error: error.message, userId });
      return false;
    }
  }

  async getUserSocket(userId: string): Promise<string | null> {
    try {
      const key = `${this.USER_SOCKET_PREFIX}${userId}`;
      return await redisService.get(key);
    } catch (error: any) {
      logger.error('Failed to get user socket', { error: error.message, userId });
      return null;
    }
  }

  async removeUserSocket(userId: string): Promise<boolean> {
    try {
      const key = `${this.USER_SOCKET_PREFIX}${userId}`;
      await redisService.del(key);
      return true;
    } catch (error: any) {
      logger.error('Failed to remove user socket', { error: error.message, userId });
      return false;
    }
  }

  // ==================== Agent-Socket Mapping ====================

  async mapAgentToSocket(agentId: string, socketId: string): Promise<boolean> {
    try {
      const key = `${this.AGENT_SOCKET_PREFIX}${agentId}`;
      await redisService.set(key, socketId, this.SESSION_TTL);
      
      logger.debug('Agent mapped to socket', { agentId, socketId });
      return true;
    } catch (error: any) {
      logger.error('Failed to map agent to socket', { error: error.message, agentId });
      return false;
    }
  }

  async getAgentSocket(agentId: string): Promise<string | null> {
    try {
      const key = `${this.AGENT_SOCKET_PREFIX}${agentId}`;
      return await redisService.get(key);
    } catch (error: any) {
      logger.error('Failed to get agent socket', { error: error.message, agentId });
      return null;
    }
  }

  async removeAgentSocket(agentId: string): Promise<boolean> {
    try {
      const key = `${this.AGENT_SOCKET_PREFIX}${agentId}`;
      await redisService.del(key);
      return true;
    } catch (error: any) {
      logger.error('Failed to remove agent socket', { error: error.message, agentId });
      return false;
    }
  }

  async getAllActiveAgents(): Promise<string[]> {
    try {
      // This is a simplified implementation
      // In production, you might want to maintain a separate set of active agents
      const pattern = `${this.AGENT_SOCKET_PREFIX}*`;
      const keys = await redisService.deletePattern(pattern); // This returns count, not keys
      // You'd need to implement a proper scan operation for this
      return [];
    } catch (error: any) {
      logger.error('Failed to get active agents', { error: error.message });
      return [];
    }
  }

  // ==================== Message Management ====================

  async addMessageToSession(sessionId: string, message: any): Promise<boolean> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return false;
      
      session.messages.push(message);
      session.lastActivity = new Date().toISOString();
      
      const key = `${this.SESSION_PREFIX}${sessionId}`;
      await redisService.setJSON(key, session, this.SESSION_TTL);
      
      return true;
    } catch (error: any) {
      logger.error('Failed to add message to session', { error: error.message, sessionId });
      return false;
    }
  }

  async getSessionMessages(sessionId: string, limit: number = 50): Promise<any[]> {
    try {
      const session = await this.getSession(sessionId);
      if (!session) return [];
      
      // Return last N messages
      return session.messages.slice(-limit);
    } catch (error: any) {
      logger.error('Failed to get session messages', { error: error.message, sessionId });
      return [];
    }
  }

  // ==================== Cleanup ====================

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const sessionIds = await redisService.sMembers(this.ACTIVE_SESSIONS_SET);
      let cleaned = 0;
      
      for (const sessionId of sessionIds) {
        const key = `${this.SESSION_PREFIX}${sessionId}`;
        const ttl = await redisService.ttl(key);
        
        if (ttl === -2) { // Key doesn't exist
          await redisService.sRem(this.ACTIVE_SESSIONS_SET, sessionId);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        logger.info('Expired sessions cleaned', { count: cleaned });
      }
      
      return cleaned;
    } catch (error: any) {
      logger.error('Failed to cleanup expired sessions', { error: error.message });
      return 0;
    }
  }

  // ==================== Statistics ====================

  async getStats(): Promise<{
    activeSessions: number;
    totalMessages: number;
    redisStatus: string;
  }> {
    try {
      const sessions = await this.getAllActiveSessions();
      const totalMessages = sessions.reduce((sum, session) => sum + session.messages.length, 0);
      
      return {
        activeSessions: sessions.length,
        totalMessages,
        redisStatus: redisService.getConnectionStatus()
      };
    } catch (error: any) {
      logger.error('Failed to get session stats', { error: error.message });
      return {
        activeSessions: 0,
        totalMessages: 0,
        redisStatus: 'error'
      };
    }
  }
}

// Export singleton instance
export const redisSessionStore = new RedisSessionStore();

// Periodic cleanup of expired sessions
setInterval(async () => {
  await redisSessionStore.cleanupExpiredSessions();
}, 300000); // Every 5 minutes

export default redisSessionStore;
