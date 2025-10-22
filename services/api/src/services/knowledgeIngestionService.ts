import { KnowledgeBase, KnowledgeType } from '../models/KnowledgeBase';
import { embeddingService } from './embeddingService';
import { logger } from '../utils/logger';

interface DocumentData {
  title: string;
  content: string;
  summary?: string;
  type: KnowledgeType;
  category?: string;
  tags?: string[];
  metadata?: Record<string, any>;
}

export class KnowledgeIngestionService {
  
  /**
   * Ingest FAQ data
   */
  public async ingestFAQs(): Promise<{ success: number; errors: number }> {
    const faqs = [
      {
        title: "How do I book a trek?",
        content: "To book a trek with us, browse our available adventures and click 'Join Trip' on any adventure that catches your eye! You'll create an account, fill in participant details, and secure your spot. Each trip has clear pricing, pickup points, and what's included.",
        type: 'faq' as KnowledgeType,
        category: 'booking',
        tags: ['booking', 'reservation', 'join trip']
      },
      {
        title: "What is the cancellation policy?",
        content: "Our cancellation policy varies by trip timing: Full refund if cancelled 30+ days before, 50% refund for 15-29 days, and 25% for 7-14 days. For cancellations within 7 days, we'll connect you with our team to discuss options.",
        type: 'faq' as KnowledgeType,
        category: 'policy',
        tags: ['cancellation', 'refund', 'policy']
      },
      {
        title: "What is included in the price?",
        content: "Our trips typically include transportation, accommodation, meals (as mentioned), experienced trek leaders, safety equipment, and permits. We also provide pickup/drop-off from designated points, first aid support, and photography services on most treks.",
        type: 'faq' as KnowledgeType,
        category: 'pricing',
        tags: ['inclusions', 'price', 'what included']
      },
      {
        title: "What safety measures do you have?",
        content: "Your safety is our top priority! All our trek leaders are certified, we carry comprehensive first aid kits, and maintain 24/7 emergency communication. We conduct safety briefings before each trek, provide quality safety equipment, and have tie-ups with local medical facilities.",
        type: 'faq' as KnowledgeType,
        category: 'safety',
        tags: ['safety', 'emergency', 'medical', 'first aid']
      },
      {
        title: "What payment methods do you accept?",
        content: "We accept all major credit cards, UPI, and digital wallets. Payment is secure and processed immediately to confirm your booking. Group discounts are available for 6+ people, and we offer flexible EMI options for premium treks.",
        type: 'faq' as KnowledgeType,
        category: 'payment',
        tags: ['payment', 'credit card', 'UPI', 'EMI']
      }
    ];

    return await this.processBatch(faqs);
  }

  /**
   * Ingest trekking guides
   */
  public async ingestGuides(): Promise<{ success: number; errors: number }> {
    const guides = [
      {
        title: "Beginner's Guide to Trekking",
        content: "Start your trekking journey with proper preparation. Choose easy trails first, invest in good footwear, pack light but smart, stay hydrated, and always inform someone about your plans. Join group treks to learn from experienced trekkers.",
        summary: "Essential tips for first-time trekkers including preparation, gear, and safety basics.",
        type: 'guide' as KnowledgeType,
        category: 'beginner',
        tags: ['beginner', 'preparation', 'first time', 'basics']
      },
      {
        title: "High Altitude Trekking Tips",
        content: "Acclimatization is key for high altitude treks. Ascend gradually, stay hydrated, recognize altitude sickness symptoms, and descend if feeling unwell. Carry diamox if prescribed by a doctor. Train your cardiovascular fitness beforehand.",
        summary: "Important guidelines for safe high altitude trekking and acclimatization.",
        type: 'guide' as KnowledgeType,
        category: 'advanced',
        tags: ['high altitude', 'acclimatization', 'altitude sickness', 'advanced']
      },
      {
        title: "Essential Trek Gear Checklist",
        content: "Must-have items: trekking shoes, backpack, warm layers, rain gear, headlamp, first aid kit, water bottles, snacks, sunscreen, and personal medications. Avoid cotton clothing, pack light, and test all gear before the trek.",
        summary: "Complete gear checklist for safe and comfortable trekking.",
        type: 'guide' as KnowledgeType,
        category: 'gear',
        tags: ['gear', 'equipment', 'packing', 'checklist']
      }
    ];

    return await this.processBatch(guides);
  }

  /**
   * Ingest a single document
   */
  public async ingestDocument(doc: DocumentData): Promise<boolean> {
    try {
      // Check if document already exists
      const existing = await KnowledgeBase.findOne({
        title: doc.title,
        type: doc.type
      });

      if (existing) {
        logger.info(`Document already exists: ${doc.title}`);
        return true;
      }

      // Generate embedding if service is ready
      let embedding: number[] = [];
      if (embeddingService.isReady()) {
        try {
          const embeddingResult = await embeddingService.generateEmbedding(
            `${doc.title} ${doc.summary || doc.content.substring(0, 500)}`
          );
          embedding = embeddingResult.embedding;
        } catch (error) {
          logger.warn(`Failed to generate embedding for: ${doc.title}`, { error });
        }
      }

      // Create document
      const knowledgeDoc = new KnowledgeBase({
        title: doc.title,
        content: doc.content,
        summary: doc.summary,
        type: doc.type,
        category: doc.category || 'general',
        tags: doc.tags || [],
        embedding,
        metadata: doc.metadata || {},
        relevanceScore: 1.0,
        queryCount: 0,
        isActive: true
      });

      await knowledgeDoc.save();
      logger.info(`Successfully ingested: ${doc.title}`);
      return true;

    } catch (error: any) {
      logger.error(`Failed to ingest document: ${doc.title}`, { error: error.message });
      return false;
    }
  }

  /**
   * Process batch of documents
   */
  private async processBatch(documents: DocumentData[]): Promise<{ success: number; errors: number }> {
    let success = 0;
    let errors = 0;

    for (const doc of documents) {
      try {
        const result = await this.ingestDocument(doc);
        if (result) {
          success++;
        } else {
          errors++;
        }
      } catch (error) {
        errors++;
        logger.error(`Failed to process document: ${doc.title}`, { error });
      }
    }

    return { success, errors };
  }

  /**
   * Initialize knowledge base with basic data
   */
  public async initializeKnowledgeBase(): Promise<{
    totalIngested: number;
    totalErrors: number;
    breakdown: Record<string, { success: number; errors: number }>;
  }> {
    logger.info('Starting knowledge base initialization...');

    const results = {
      totalIngested: 0,
      totalErrors: 0,
      breakdown: {} as Record<string, { success: number; errors: number }>
    };

    try {
      // Ingest FAQs
      const faqResults = await this.ingestFAQs();
      results.breakdown.faqs = faqResults;
      results.totalIngested += faqResults.success;
      results.totalErrors += faqResults.errors;

      // Ingest Guides
      const guideResults = await this.ingestGuides();
      results.breakdown.guides = guideResults;
      results.totalIngested += guideResults.success;
      results.totalErrors += guideResults.errors;

      logger.info('Knowledge base initialization completed', results);
      return results;

    } catch (error: any) {
      logger.error('Error during knowledge base initialization', { error: error.message });
      throw error;
    }
  }

  /**
   * Get ingestion status
   */
  public async getStatus(): Promise<{
    totalDocuments: number;
    documentsByType: Record<string, number>;
    embeddingServiceReady: boolean;
  }> {
    const [totalCount, typeStats] = await Promise.all([
      KnowledgeBase.countDocuments({ isActive: true }),
      KnowledgeBase.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$type', count: { $sum: 1 } } }
      ])
    ]);

    const documentsByType = typeStats.reduce((acc: any, item: any) => {
      acc[item._id] = item.count;
      return acc;
    }, {});

    return {
      totalDocuments: totalCount,
      documentsByType,
      embeddingServiceReady: embeddingService.isReady()
    };
  }

  /**
   * Clear all documents (for testing)
   */
  public async clearAll(): Promise<{ deletedCount: number }> {
    logger.warn('Clearing all knowledge base documents');
    const result = await KnowledgeBase.deleteMany({});
    return { deletedCount: result.deletedCount || 0 };
  }
}

export const knowledgeIngestionService = new KnowledgeIngestionService();