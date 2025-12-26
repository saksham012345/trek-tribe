import AIConversation from '../models/AIConversation';
import { logger } from '../utils/logger';

/**
 * Advanced Conversation Analytics Service
 * Provides detailed insights into AI conversation patterns, user behavior, and system performance
 */

interface ConversationInsights {
  totalConversations: number;
  totalMessages: number;
  averageMessagesPerConversation: number;
  averageResponseTime: number;
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
  topTopics: Array<{ topic: string; count: number }>;
  humanHandoffRate: number;
  resolutionRate: number;
  peakHours: Array<{ hour: number; count: number }>;
}

interface UserEngagementMetrics {
  userId: string;
  conversationCount: number;
  messageCount: number;
  averageSessionDuration: number;
  lastInteraction: Date;
  topicPreferences: string[];
  satisfactionScore: number;
}

interface PerformanceMetrics {
  averageFirstResponseTime: number;
  averageResponseTime: number;
  successfulResolutions: number;
  escalatedToHuman: number;
  errorRate: number;
  uptimePercentage: number;
}

class AIConversationAnalyticsService {
  /**
   * Get comprehensive conversation insights for a given time period
   */
  async getConversationInsights(
    startDate: Date,
    endDate: Date,
    userId?: string
  ): Promise<ConversationInsights> {
    try {
      const query: any = {
        createdAt: { $gte: startDate, $lte: endDate }
      };

      if (userId) {
        query.userId = userId;
      }

      const conversations = await AIConversation.find(query);
      
      // Calculate metrics
      const totalConversations = conversations.length;
      const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
      const averageMessagesPerConversation = totalConversations > 0 
        ? totalMessages / totalConversations 
        : 0;

      // Calculate average response time
      let totalResponseTime = 0;
      let responseCount = 0;

      conversations.forEach(conv => {
        conv.messages.forEach(msg => {
          if (msg.responseTime) {
            totalResponseTime += msg.responseTime;
            responseCount++;
          }
        });
      });

      const averageResponseTime = responseCount > 0 
        ? totalResponseTime / responseCount 
        : 0;

      // Sentiment analysis (simplified)
      const sentimentDistribution = {
        positive: 0,
        neutral: 0,
        negative: 0
      };

      conversations.forEach(conv => {
        const sentiment = (conv as any).sentiment || 'neutral';
        if (sentiment in sentimentDistribution) {
          sentimentDistribution[sentiment as keyof typeof sentimentDistribution]++;
        }
      });

      // Top topics
      const topicCounts: { [key: string]: number } = {};
      conversations.forEach(conv => {
        conv.messages.forEach(msg => {
          if (msg.topic) {
            topicCounts[msg.topic] = (topicCounts[msg.topic] || 0) + 1;
          }
        });
      });

      const topTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([topic, count]) => ({ topic, count }));

      // Human handoff rate
      const handoffCount = conversations.filter(conv => 
        conv.messages.some(msg => msg.requiresHumanAgent)
      ).length;
      const humanHandoffRate = totalConversations > 0 
        ? (handoffCount / totalConversations) * 100 
        : 0;

      // Resolution rate
      const resolvedCount = conversations.filter(conv => 
        (conv as any).resolved === true
      ).length;
      const resolutionRate = totalConversations > 0 
        ? (resolvedCount / totalConversations) * 100 
        : 0;

      // Peak hours analysis
      const hourCounts: { [hour: number]: number } = {};
      conversations.forEach(conv => {
        const hour = new Date(conv.createdAt).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      const peakHours = Object.entries(hourCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([hour, count]) => ({ hour: parseInt(hour), count }));

      logger.info('Conversation insights generated', {
        totalConversations,
        totalMessages,
        timeRange: { startDate, endDate }
      });

      return {
        totalConversations,
        totalMessages,
        averageMessagesPerConversation: parseFloat(averageMessagesPerConversation.toFixed(2)),
        averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
        sentimentDistribution,
        topTopics,
        humanHandoffRate: parseFloat(humanHandoffRate.toFixed(2)),
        resolutionRate: parseFloat(resolutionRate.toFixed(2)),
        peakHours
      };
    } catch (error: any) {
      logger.error('Error generating conversation insights', { error: error.message });
      throw error;
    }
  }

  /**
   * Get user engagement metrics
   */
  async getUserEngagementMetrics(userId: string): Promise<UserEngagementMetrics> {
    try {
      const conversations = await AIConversation.find({ userId }).sort({ createdAt: -1 });
      
      const conversationCount = conversations.length;
      const messageCount = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);

      // Calculate average session duration
      let totalDuration = 0;
      conversations.forEach(conv => {
        if (conv.messages.length > 1) {
          const firstMsg = conv.messages[0];
          const lastMsg = conv.messages[conv.messages.length - 1];
          const duration = new Date(lastMsg.timestamp).getTime() - new Date(firstMsg.timestamp).getTime();
          totalDuration += duration;
        }
      });

      const averageSessionDuration = conversationCount > 0 
        ? totalDuration / conversationCount / 1000 // Convert to seconds
        : 0;

      // Get topic preferences
      const topicCounts: { [key: string]: number } = {};
      conversations.forEach(conv => {
        conv.messages.forEach(msg => {
          if (msg.topic) {
            topicCounts[msg.topic] = (topicCounts[msg.topic] || 0) + 1;
          }
        });
      });

      const topicPreferences = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic]) => topic);

      // Calculate satisfaction score (based on resolved conversations)
      const resolvedCount = conversations.filter(conv => (conv as any).resolved === true).length;
      const satisfactionScore = conversationCount > 0 
        ? (resolvedCount / conversationCount) * 100 
        : 0;

      const lastInteraction = conversations.length > 0 
        ? conversations[0].updatedAt 
        : new Date();

      return {
        userId,
        conversationCount,
        messageCount,
        averageSessionDuration: parseFloat(averageSessionDuration.toFixed(2)),
        lastInteraction,
        topicPreferences,
        satisfactionScore: parseFloat(satisfactionScore.toFixed(2))
      };
    } catch (error: any) {
      logger.error('Error getting user engagement metrics', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Get AI performance metrics
   */
  async getPerformanceMetrics(startDate: Date, endDate: Date): Promise<PerformanceMetrics> {
    try {
      const conversations = await AIConversation.find({
        createdAt: { $gte: startDate, $lte: endDate }
      });

      // Calculate first response time (time to first AI message)
      let totalFirstResponseTime = 0;
      let firstResponseCount = 0;

      conversations.forEach(conv => {
        if (conv.messages.length >= 2) {
          const userMsg = conv.messages[0];
          const aiMsg = conv.messages.find(msg => msg.sender === 'ai');
          if (aiMsg) {
            const responseTime = new Date(aiMsg.timestamp).getTime() - new Date(userMsg.timestamp).getTime();
            totalFirstResponseTime += responseTime;
            firstResponseCount++;
          }
        }
      });

      const averageFirstResponseTime = firstResponseCount > 0 
        ? totalFirstResponseTime / firstResponseCount / 1000 
        : 0;

      // Calculate overall response time
      let totalResponseTime = 0;
      let responseCount = 0;

      conversations.forEach(conv => {
        conv.messages.forEach(msg => {
          if (msg.responseTime) {
            totalResponseTime += msg.responseTime;
            responseCount++;
          }
        });
      });

      const averageResponseTime = responseCount > 0 
        ? totalResponseTime / responseCount 
        : 0;

      // Count successful resolutions
      const successfulResolutions = conversations.filter(conv => 
        (conv as any).resolved === true
      ).length;

      // Count escalations to human
      const escalatedToHuman = conversations.filter(conv => 
        conv.messages.some(msg => msg.requiresHumanAgent)
      ).length;

      // Calculate error rate
      const totalMessages = conversations.reduce((sum, conv) => sum + conv.messages.length, 0);
      const errorMessages = conversations.reduce((sum, conv) => 
        sum + conv.messages.filter(msg => (msg as any).error).length, 0
      );
      const errorRate = totalMessages > 0 
        ? (errorMessages / totalMessages) * 100 
        : 0;

      // Uptime percentage (simplified - assumes 24/7 operation)
      const uptimePercentage = 99.5; // Can be calculated based on actual downtime logs

      logger.info('Performance metrics calculated', {
        averageFirstResponseTime,
        averageResponseTime,
        successfulResolutions,
        escalatedToHuman
      });

      return {
        averageFirstResponseTime: parseFloat(averageFirstResponseTime.toFixed(2)),
        averageResponseTime: parseFloat(averageResponseTime.toFixed(2)),
        successfulResolutions,
        escalatedToHuman,
        errorRate: parseFloat(errorRate.toFixed(2)),
        uptimePercentage
      };
    } catch (error: any) {
      logger.error('Error calculating performance metrics', { error: error.message });
      throw error;
    }
  }

  /**
   * Get conversation trend analysis
   */
  async getTrendAnalysis(days: number = 30): Promise<any> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const conversations = await AIConversation.find({
        createdAt: { $gte: startDate, $lte: endDate }
      }).sort({ createdAt: 1 });

      // Group conversations by day
      const dailyData: { [date: string]: { count: number; messages: number } } = {};

      conversations.forEach(conv => {
        const dateKey = new Date(conv.createdAt).toISOString().split('T')[0];
        if (!dailyData[dateKey]) {
          dailyData[dateKey] = { count: 0, messages: 0 };
        }
        dailyData[dateKey].count++;
        dailyData[dateKey].messages += conv.messages.length;
      });

      const trend = Object.entries(dailyData)
        .map(([date, data]) => ({
          date,
          conversations: data.count,
          messages: data.messages
        }));

      // Calculate growth rate
      const firstWeekAvg = trend.slice(0, 7).reduce((sum, d) => sum + d.conversations, 0) / 7;
      const lastWeekAvg = trend.slice(-7).reduce((sum, d) => sum + d.conversations, 0) / 7;
      const growthRate = firstWeekAvg > 0 
        ? ((lastWeekAvg - firstWeekAvg) / firstWeekAvg) * 100 
        : 0;

      return {
        period: `${days} days`,
        trend,
        growthRate: parseFloat(growthRate.toFixed(2)),
        summary: {
          totalConversations: conversations.length,
          averagePerDay: parseFloat((conversations.length / days).toFixed(2))
        }
      };
    } catch (error: any) {
      logger.error('Error generating trend analysis', { error: error.message });
      throw error;
    }
  }
}

export const aiConversationAnalyticsService = new AIConversationAnalyticsService();
export default aiConversationAnalyticsService;
