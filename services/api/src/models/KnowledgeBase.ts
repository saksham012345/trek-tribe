import mongoose, { Schema, Document } from 'mongoose';

export type KnowledgeType = 'faq' | 'guide' | 'policy' | 'trip' | 'general';

export interface IKnowledgeBase extends Document {
  title: string;
  content: string;
  summary?: string;
  type: KnowledgeType;
  category: string;
  tags: string[];
  embedding: number[];
  metadata: Record<string, any>;
  context: Record<string, any>;
  sourceUrl?: string;
  relevanceScore: number;
  queryCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeBaseSchema = new Schema<IKnowledgeBase>({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    maxlength: 10000
  },
  summary: {
    type: String,
    maxlength: 500
  },
  type: {
    type: String,
    required: true,
    enum: ['faq', 'guide', 'policy', 'trip', 'general'],
    index: true
  },
  category: {
    type: String,
    required: true,
    trim: true,
    index: true
  },
  tags: [{
    type: String,
    trim: true
  }],
  embedding: [{
    type: Number
  }],
  metadata: {
    type: Schema.Types.Mixed,
    default: {}
  },
  context: {
    type: Schema.Types.Mixed,
    default: {}
  },
  sourceUrl: {
    type: String,
    trim: true
  },
  relevanceScore: {
    type: Number,
    default: 1.0,
    min: 0,
    max: 5
  },
  queryCount: {
    type: Number,
    default: 0,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for performance
KnowledgeBaseSchema.index({ type: 1, isActive: 1 });
KnowledgeBaseSchema.index({ category: 1, isActive: 1 });
KnowledgeBaseSchema.index({ tags: 1 });
KnowledgeBaseSchema.index({ 'metadata.price': 1 });
KnowledgeBaseSchema.index({ 'context.destination': 1 });
KnowledgeBaseSchema.index({ 'context.difficulty': 1 });
KnowledgeBaseSchema.index({ createdAt: -1 });
KnowledgeBaseSchema.index({ relevanceScore: -1 });

// Text index for search
KnowledgeBaseSchema.index({
  title: 'text',
  content: 'text',
  summary: 'text',
  tags: 'text'
}, {
  weights: {
    title: 10,
    summary: 5,
    content: 2,
    tags: 3
  }
});

// Update the updatedAt field before saving
KnowledgeBaseSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static methods for semantic search
KnowledgeBaseSchema.statics.semanticSearch = function(query: string, options: {
  type?: KnowledgeType[];
  category?: string;
  limit?: number;
  minScore?: number;
} = {}) {
  const {
    type = ['faq', 'guide', 'policy', 'trip'],
    category,
    limit = 10,
    minScore = 0.1
  } = options;

  const pipeline: any[] = [
    {
      $match: {
        $text: { $search: query },
        type: { $in: type },
        isActive: true,
        ...(category && { category })
      }
    },
    {
      $addFields: {
        searchScore: { $meta: 'textScore' }
      }
    },
    {
      $match: {
        searchScore: { $gte: minScore }
      }
    },
    {
      $sort: {
        searchScore: -1,
        relevanceScore: -1,
        queryCount: -1
      }
    },
    {
      $limit: limit
    }
  ];

  return this.aggregate(pipeline);
};

// Instance methods
KnowledgeBaseSchema.methods.incrementQueryCount = function() {
  this.queryCount += 1;
  return this.save();
};

KnowledgeBaseSchema.methods.updateRelevanceScore = function(newScore: number) {
  // Weighted average of old and new scores
  this.relevanceScore = (this.relevanceScore * 0.8) + (newScore * 0.2);
  return this.save();
};

export const KnowledgeBase = mongoose.model<IKnowledgeBase>('KnowledgeBase', KnowledgeBaseSchema);