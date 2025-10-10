export interface AIConfig {
  // Model parameters
  searchRelevanceThreshold: number;
  recommendationConfidenceThreshold: number;
  maxSearchResults: number;
  maxRecommendations: number;
  
  // Caching parameters
  enableCaching: boolean;
  cacheExpiryMinutes: number;
  searchCacheSize: number;
  recommendationCacheSize: number;
  
  // Performance optimization
  enableAsyncProcessing: boolean;
  maxConcurrentRequests: number;
  requestTimeoutMs: number;
  
  // Scoring weights
  scoringWeights: {
    rating: number;
    popularity: number;
    recency: number;
    priceMatch: number;
    categoryMatch: number;
    userPreference: number;
  };
  
  // Chat configuration  
  chatConfig: {
    maxContextLength: number;
    responseTimeout: number;
    fallbackToHumanThreshold: number;
    enableSentimentAnalysis: boolean;
  };
  
  // Analytics configuration
  analyticsConfig: {
    refreshIntervalHours: number;
    enableRealTimeUpdates: boolean;
    maxHistoryMonths: number;
  };
}

export const defaultAIConfig: AIConfig = {
  // Model parameters
  searchRelevanceThreshold: 0.3,
  recommendationConfidenceThreshold: 0.5,
  maxSearchResults: 20,
  maxRecommendations: 10,
  
  // Caching parameters
  enableCaching: process.env.NODE_ENV === 'production',
  cacheExpiryMinutes: 30,
  searchCacheSize: 1000,
  recommendationCacheSize: 500,
  
  // Performance optimization
  enableAsyncProcessing: true,
  maxConcurrentRequests: 10,
  requestTimeoutMs: 15000,
  
  // Scoring weights
  scoringWeights: {
    rating: 0.25,
    popularity: 0.15,
    recency: 0.10,
    priceMatch: 0.20,
    categoryMatch: 0.25,
    userPreference: 0.05
  },
  
  // Chat configuration
  chatConfig: {
    maxContextLength: 2000,
    responseTimeout: 5000,
    fallbackToHumanThreshold: 0.7,
    enableSentimentAnalysis: false
  },
  
  // Analytics configuration
  analyticsConfig: {
    refreshIntervalHours: 24,
    enableRealTimeUpdates: false,
    maxHistoryMonths: 12
  }
};

// Environment-specific overrides
const getAIConfig = (): AIConfig => {
  const config = { ...defaultAIConfig };
  
  // Production optimizations
  if (process.env.NODE_ENV === 'production') {
    config.enableCaching = true;
    config.cacheExpiryMinutes = 60;
    config.enableAsyncProcessing = true;
    config.analyticsConfig.enableRealTimeUpdates = true;
  }
  
  // Development settings
  if (process.env.NODE_ENV === 'development') {
    config.enableCaching = false;
    config.requestTimeoutMs = 30000; // Longer timeout for debugging
    config.maxSearchResults = 50; // More results for testing
  }
  
  // Override with environment variables if provided
  if (process.env.AI_MAX_SEARCH_RESULTS) {
    config.maxSearchResults = parseInt(process.env.AI_MAX_SEARCH_RESULTS, 10);
  }
  
  if (process.env.AI_CACHE_EXPIRY_MINUTES) {
    config.cacheExpiryMinutes = parseInt(process.env.AI_CACHE_EXPIRY_MINUTES, 10);
  }
  
  if (process.env.AI_REQUEST_TIMEOUT_MS) {
    config.requestTimeoutMs = parseInt(process.env.AI_REQUEST_TIMEOUT_MS, 10);
  }
  
  return config;
};

export const aiConfig = getAIConfig();

// Helper functions for configuration
export const getScaledScore = (baseScore: number, weight: number): number => {
  return baseScore * weight;
};

export const isHighConfidence = (score: number): boolean => {
  return score >= aiConfig.recommendationConfidenceThreshold;
};

export const shouldEnableFeature = (feature: keyof AIConfig): boolean => {
  return aiConfig[feature] as boolean;
};

// Validation function
export const validateAIConfig = (config: AIConfig): string[] => {
  const errors: string[] = [];
  
  if (config.searchRelevanceThreshold < 0 || config.searchRelevanceThreshold > 1) {
    errors.push('searchRelevanceThreshold must be between 0 and 1');
  }
  
  if (config.recommendationConfidenceThreshold < 0 || config.recommendationConfidenceThreshold > 1) {
    errors.push('recommendationConfidenceThreshold must be between 0 and 1');
  }
  
  if (config.maxSearchResults <= 0 || config.maxSearchResults > 100) {
    errors.push('maxSearchResults must be between 1 and 100');
  }
  
  if (config.maxRecommendations <= 0 || config.maxRecommendations > 50) {
    errors.push('maxRecommendations must be between 1 and 50');
  }
  
  if (config.cacheExpiryMinutes <= 0) {
    errors.push('cacheExpiryMinutes must be greater than 0');
  }
  
  if (config.requestTimeoutMs <= 0) {
    errors.push('requestTimeoutMs must be greater than 0');
  }
  
  // Validate scoring weights sum to reasonable range
  const totalWeight = Object.values(config.scoringWeights).reduce((sum, weight) => sum + weight, 0);
  if (totalWeight < 0.8 || totalWeight > 1.2) {
    errors.push('Scoring weights should sum to approximately 1.0');
  }
  
  return errors;
};

// Export singleton instance
export default aiConfig;