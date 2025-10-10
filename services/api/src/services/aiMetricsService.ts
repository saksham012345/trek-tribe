interface MetricEntry {
  timestamp: number;
  value: number;
  metadata?: any;
}

interface PerformanceMetrics {
  responseTime: MetricEntry[];
  requestCount: MetricEntry[];
  errorCount: MetricEntry[];
  cacheHitRatio: MetricEntry[];
  throughput: MetricEntry[];
}

interface UsageMetrics {
  smartSearch: {
    totalQueries: number;
    uniqueQueries: number;
    avgResultsReturned: number;
    popularCategories: Record<string, number>;
    queryTypes: Record<string, number>;
  };
  recommendations: {
    totalRequests: number;
    uniqueUsers: number;
    avgRecommendations: number;
    clickThroughRate: number;
  };
  analytics: {
    totalRequests: number;
    uniqueUsers: number;
    avgProcessingTime: number;
  };
  chat: {
    totalMessages: number;
    uniqueSessions: number;
    avgResponseTime: number;
    humanHandoffRate: number;
  };
}

class AIMetricsService {
  private performanceMetrics: PerformanceMetrics = {
    responseTime: [],
    requestCount: [],
    errorCount: [],
    cacheHitRatio: [],
    throughput: []
  };

  private usageMetrics: UsageMetrics = {
    smartSearch: {
      totalQueries: 0,
      uniqueQueries: 0,
      avgResultsReturned: 0,
      popularCategories: {},
      queryTypes: {}
    },
    recommendations: {
      totalRequests: 0,
      uniqueUsers: 0,
      avgRecommendations: 0,
      clickThroughRate: 0
    },
    analytics: {
      totalRequests: 0,
      uniqueUsers: 0,
      avgProcessingTime: 0
    },
    chat: {
      totalMessages: 0,
      uniqueSessions: 0,
      avgResponseTime: 0,
      humanHandoffRate: 0
    }
  };

  private readonly maxMetricEntries = 1000; // Keep last 1000 entries
  private readonly aggregationIntervalMs = 60000; // 1 minute
  private requestCounts: { [key: string]: number } = {};

  constructor() {
    // Start aggregation interval
    setInterval(() => {
      this.aggregateMetrics();
    }, this.aggregationIntervalMs);

    console.log('📊 AI Metrics Service initialized');
  }

  // Performance tracking methods
  recordResponseTime(endpoint: string, duration: number, metadata?: any): void {
    this.addMetricEntry('responseTime', duration, { endpoint, ...metadata });
    this.incrementRequestCount(endpoint);
  }

  recordError(endpoint: string, error: string, metadata?: any): void {
    this.addMetricEntry('errorCount', 1, { endpoint, error, ...metadata });
  }

  recordCacheHit(cacheType: string, hit: boolean): void {
    const value = hit ? 1 : 0;
    this.addMetricEntry('cacheHitRatio', value, { cacheType });
  }

  recordThroughput(endpoint: string, requestsPerSecond: number): void {
    this.addMetricEntry('throughput', requestsPerSecond, { endpoint });
  }

  // Usage tracking methods
  recordSmartSearch(query: string, resultCount: number, categories: string[]): void {
    this.usageMetrics.smartSearch.totalQueries++;
    this.usageMetrics.smartSearch.avgResultsReturned = this.updateAverage(
      this.usageMetrics.smartSearch.avgResultsReturned,
      resultCount,
      this.usageMetrics.smartSearch.totalQueries
    );

    // Track categories
    categories.forEach(category => {
      this.usageMetrics.smartSearch.popularCategories[category] = 
        (this.usageMetrics.smartSearch.popularCategories[category] || 0) + 1;
    });

    // Classify query type
    const queryType = this.classifyQuery(query);
    this.usageMetrics.smartSearch.queryTypes[queryType] = 
      (this.usageMetrics.smartSearch.queryTypes[queryType] || 0) + 1;
  }

  recordRecommendation(userId: string, recommendationCount: number): void {
    this.usageMetrics.recommendations.totalRequests++;
    this.usageMetrics.recommendations.avgRecommendations = this.updateAverage(
      this.usageMetrics.recommendations.avgRecommendations,
      recommendationCount,
      this.usageMetrics.recommendations.totalRequests
    );
  }

  recordAnalyticsRequest(userId: string, processingTime: number): void {
    this.usageMetrics.analytics.totalRequests++;
    this.usageMetrics.analytics.avgProcessingTime = this.updateAverage(
      this.usageMetrics.analytics.avgProcessingTime,
      processingTime,
      this.usageMetrics.analytics.totalRequests
    );
  }

  recordChatMessage(sessionId: string, responseTime: number, requiresHumanAgent: boolean): void {
    this.usageMetrics.chat.totalMessages++;
    this.usageMetrics.chat.avgResponseTime = this.updateAverage(
      this.usageMetrics.chat.avgResponseTime,
      responseTime,
      this.usageMetrics.chat.totalMessages
    );

    if (requiresHumanAgent) {
      this.usageMetrics.chat.humanHandoffRate = this.updateAverage(
        this.usageMetrics.chat.humanHandoffRate,
        1,
        this.usageMetrics.chat.totalMessages
      );
    }
  }

  // Metrics retrieval methods
  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  getUsageMetrics(): UsageMetrics {
    return { ...this.usageMetrics };
  }

  getAverageResponseTime(endpoint?: string): number {
    const relevantEntries = endpoint 
      ? this.performanceMetrics.responseTime.filter(entry => entry.metadata?.endpoint === endpoint)
      : this.performanceMetrics.responseTime;

    if (relevantEntries.length === 0) return 0;

    const sum = relevantEntries.reduce((total, entry) => total + entry.value, 0);
    return sum / relevantEntries.length;
  }

  getErrorRate(endpoint?: string): number {
    const errorEntries = endpoint 
      ? this.performanceMetrics.errorCount.filter(entry => entry.metadata?.endpoint === endpoint)
      : this.performanceMetrics.errorCount;

    const requestEntries = endpoint 
      ? this.performanceMetrics.requestCount.filter(entry => entry.metadata?.endpoint === endpoint)
      : this.performanceMetrics.requestCount;

    const totalErrors = errorEntries.reduce((total, entry) => total + entry.value, 0);
    const totalRequests = requestEntries.reduce((total, entry) => total + entry.value, 0);

    return totalRequests > 0 ? totalErrors / totalRequests : 0;
  }

  getCacheHitRatio(cacheType?: string): number {
    const relevantEntries = cacheType 
      ? this.performanceMetrics.cacheHitRatio.filter(entry => entry.metadata?.cacheType === cacheType)
      : this.performanceMetrics.cacheHitRatio;

    if (relevantEntries.length === 0) return 0;

    const hits = relevantEntries.reduce((total, entry) => total + entry.value, 0);
    return hits / relevantEntries.length;
  }

  // Health check methods
  getHealthMetrics() {
    const now = Date.now();
    const fiveMinutesAgo = now - (5 * 60 * 1000);

    // Get recent metrics
    const recentResponseTimes = this.performanceMetrics.responseTime
      .filter(entry => entry.timestamp > fiveMinutesAgo)
      .map(entry => entry.value);

    const recentErrors = this.performanceMetrics.errorCount
      .filter(entry => entry.timestamp > fiveMinutesAgo)
      .reduce((total, entry) => total + entry.value, 0);

    const recentRequests = this.performanceMetrics.requestCount
      .filter(entry => entry.timestamp > fiveMinutesAgo)
      .reduce((total, entry) => total + entry.value, 0);

    const avgResponseTime = recentResponseTimes.length > 0 
      ? recentResponseTimes.reduce((a, b) => a + b, 0) / recentResponseTimes.length 
      : 0;

    const errorRate = recentRequests > 0 ? recentErrors / recentRequests : 0;

    return {
      status: this.determineHealthStatus(avgResponseTime, errorRate),
      metrics: {
        averageResponseTime: avgResponseTime,
        errorRate: errorRate,
        requestsPerMinute: recentRequests,
        cacheHitRatio: this.getCacheHitRatio()
      },
      timestamp: new Date().toISOString()
    };
  }

  // Export metrics for external monitoring systems
  exportMetrics(format: 'json' | 'prometheus' = 'json') {
    if (format === 'prometheus') {
      return this.toPrometheusFormat();
    }

    return {
      performance: this.getPerformanceMetrics(),
      usage: this.getUsageMetrics(),
      health: this.getHealthMetrics(),
      summary: {
        totalRequests: Object.values(this.requestCounts).reduce((a, b) => a + b, 0),
        averageResponseTime: this.getAverageResponseTime(),
        overallErrorRate: this.getErrorRate(),
        overallCacheHitRatio: this.getCacheHitRatio()
      }
    };
  }

  // Reset metrics (useful for testing)
  resetMetrics(): void {
    this.performanceMetrics = {
      responseTime: [],
      requestCount: [],
      errorCount: [],
      cacheHitRatio: [],
      throughput: []
    };

    this.usageMetrics = {
      smartSearch: {
        totalQueries: 0,
        uniqueQueries: 0,
        avgResultsReturned: 0,
        popularCategories: {},
        queryTypes: {}
      },
      recommendations: {
        totalRequests: 0,
        uniqueUsers: 0,
        avgRecommendations: 0,
        clickThroughRate: 0
      },
      analytics: {
        totalRequests: 0,
        uniqueUsers: 0,
        avgProcessingTime: 0
      },
      chat: {
        totalMessages: 0,
        uniqueSessions: 0,
        avgResponseTime: 0,
        humanHandoffRate: 0
      }
    };

    this.requestCounts = {};
    console.log('📊 AI Metrics reset');
  }

  // Private helper methods
  private addMetricEntry(metricType: keyof PerformanceMetrics, value: number, metadata?: any): void {
    const entry: MetricEntry = {
      timestamp: Date.now(),
      value,
      metadata
    };

    this.performanceMetrics[metricType].push(entry);

    // Keep only recent entries
    if (this.performanceMetrics[metricType].length > this.maxMetricEntries) {
      this.performanceMetrics[metricType].shift();
    }
  }

  private incrementRequestCount(endpoint: string): void {
    this.requestCounts[endpoint] = (this.requestCounts[endpoint] || 0) + 1;
    this.addMetricEntry('requestCount', 1, { endpoint });
  }

  private updateAverage(currentAvg: number, newValue: number, totalCount: number): number {
    return ((currentAvg * (totalCount - 1)) + newValue) / totalCount;
  }

  private classifyQuery(query: string): string {
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('mountain') || lowerQuery.includes('trek') || lowerQuery.includes('hiking')) {
      return 'adventure';
    }
    if (lowerQuery.includes('beach') || lowerQuery.includes('coastal') || lowerQuery.includes('ocean')) {
      return 'beach';
    }
    if (lowerQuery.includes('cultural') || lowerQuery.includes('heritage') || lowerQuery.includes('historic')) {
      return 'cultural';
    }
    if (lowerQuery.includes('luxury') || lowerQuery.includes('premium')) {
      return 'luxury';
    }
    
    return 'general';
  }

  private determineHealthStatus(avgResponseTime: number, errorRate: number): 'healthy' | 'warning' | 'critical' {
    if (errorRate > 0.1 || avgResponseTime > 5000) { // 10% error rate or 5s response time
      return 'critical';
    }
    if (errorRate > 0.05 || avgResponseTime > 2000) { // 5% error rate or 2s response time
      return 'warning';
    }
    return 'healthy';
  }

  private aggregateMetrics(): void {
    // This method can be used to aggregate metrics over time
    // For now, we'll just log a summary
    const summary = {
      totalRequests: Object.values(this.requestCounts).reduce((a, b) => a + b, 0),
      avgResponseTime: this.getAverageResponseTime(),
      errorRate: this.getErrorRate(),
      cacheHitRatio: this.getCacheHitRatio()
    };

    console.log('📈 AI Metrics Summary:', summary);
  }

  private toPrometheusFormat(): string {
    // Convert metrics to Prometheus format
    const metrics = [];
    
    metrics.push(`# HELP ai_response_time_seconds Response time in seconds`);
    metrics.push(`# TYPE ai_response_time_seconds histogram`);
    metrics.push(`ai_response_time_seconds_sum{} ${this.performanceMetrics.responseTime.reduce((sum, entry) => sum + entry.value, 0) / 1000}`);
    metrics.push(`ai_response_time_seconds_count{} ${this.performanceMetrics.responseTime.length}`);

    metrics.push(`# HELP ai_requests_total Total number of requests`);
    metrics.push(`# TYPE ai_requests_total counter`);
    Object.entries(this.requestCounts).forEach(([endpoint, count]) => {
      metrics.push(`ai_requests_total{endpoint="${endpoint}"} ${count}`);
    });

    metrics.push(`# HELP ai_errors_total Total number of errors`);
    metrics.push(`# TYPE ai_errors_total counter`);
    metrics.push(`ai_errors_total{} ${this.performanceMetrics.errorCount.reduce((sum, entry) => sum + entry.value, 0)}`);

    metrics.push(`# HELP ai_cache_hit_ratio Cache hit ratio`);
    metrics.push(`# TYPE ai_cache_hit_ratio gauge`);
    metrics.push(`ai_cache_hit_ratio{} ${this.getCacheHitRatio()}`);

    return metrics.join('\n');
  }
}

// Export singleton instance
export const aiMetricsService = new AIMetricsService();

// Middleware for automatic request tracking
export const aiMetricsMiddleware = (endpoint: string) => {
  return (req: any, res: any, next: any) => {
    const startTime = Date.now();

    // Override res.json to capture when response is sent
    const originalJson = res.json;
    res.json = function(body: any) {
      const duration = Date.now() - startTime;
      aiMetricsService.recordResponseTime(endpoint, duration, {
        method: req.method,
        status: res.statusCode,
        userId: req.user?.id
      });
      
      return originalJson.call(this, body);
    };

    // Override res.status to capture errors
    const originalStatus = res.status;
    res.status = function(code: number) {
      if (code >= 400) {
        aiMetricsService.recordError(endpoint, `HTTP ${code}`, {
          method: req.method,
          userId: req.user?.id
        });
      }
      return originalStatus.call(this, code);
    };

    next();
  };
};

export default aiMetricsService;