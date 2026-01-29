import { KnowledgeBase, KnowledgeType } from '../models/KnowledgeBase';
import { embeddingService } from '../services/embeddingService';
import { logger } from '../utils/logger';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

interface MovieCharacter {
  id: string;
  name: string;
  movieId: string;
  movieTitle: string;
  gender: string;
  position: string;
}

interface MovieTitle {
  id: string;
  title: string;
  year: number;
  rating: number;
  votes: number;
  genres: string[];
}

/**
 * Parse TSV files and extract movie data
 */
class MovieDataParser {
  private charactersFile = path.join(process.cwd(), 'movie_characters_metadata.tsv');
  private titlesFile = path.join(process.cwd(), 'movie_titles_metadata.tsv');

  public parseCharacters(): MovieCharacter[] {
    const content = fs.readFileSync(this.charactersFile, 'utf-8');
    const lines = content.trim().split('\n');
    
    return lines.map(line => {
      const [id, name, movieId, movieTitle, gender, position] = line.split('\t');
      return { id, name, movieId, movieTitle, gender, position };
    });
  }

  public parseMovieTitles(): MovieTitle[] {
    const content = fs.readFileSync(this.titlesFile, 'utf-8');
    const lines = content.trim().split('\n');
    
    return lines.map(line => {
      const [id, title, year, rating, votes, genresStr] = line.split('\t');
      const genres = genresStr
        .replace(/[\[\]']/g, '')
        .split(' ')
        .filter(g => g.length > 0);
      
      return {
        id,
        title,
        year: parseInt(year),
        rating: parseFloat(rating),
        votes: parseInt(votes),
        genres
      };
    });
  }
}

/**
 * Generate conversational training data from movie data
 */
class ConversationalTrainingGenerator {
  
  /**
   * Generate uplifting and encouraging responses based on movie themes
   */
  public generateUpliftingResponses(movies: MovieTitle[]): Array<{
    title: string;
    content: string;
    summary: string;
    type: KnowledgeType;
    category: string;
    tags: string[];
  }> {
    const responses: any[] = [];

    // Adventure & Exploration themed responses
    const adventureMovies = movies.filter(m => 
      m.genres.includes('adventure') && m.rating > 7.0
    );

    if (adventureMovies.length > 0) {
      responses.push({
        title: 'Embracing Adventure and Exploration',
        content: `Just like the epic adventures in films like "${adventureMovies[0]?.title}", every trek is a journey of discovery! Whether you're exploring mountain peaks or forest trails, remember that the greatest adventures often begin with a single step. Our treks are designed to bring out your inner explorer, just like the heroes in these beloved adventure films. The mountains are calling, and adventure awaits! 🏔️`,
        summary: 'Inspirational message connecting adventure films to trekking experiences',
        type: 'general' as KnowledgeType,
        category: 'inspiration',
        tags: ['adventure', 'motivation', 'exploration', 'journey']
      });
    }

    // Drama & Overcoming challenges
    const dramaMovies = movies.filter(m => 
      m.genres.includes('drama') && m.rating > 7.5
    );

    if (dramaMovies.length > 0) {
      responses.push({
        title: 'Overcoming Challenges Together',
        content: `Great stories teach us about perseverance and courage. Whether it's the determination shown in films or the challenges we face on the trail, every obstacle is an opportunity to grow. At Trek Tribe, we believe in supporting each other through every step of the journey. Remember, the summit is sweeter when reached together! 💪`,
        summary: 'Motivational content about facing challenges inspired by dramatic storytelling',
        type: 'general' as KnowledgeType,
        category: 'motivation',
        tags: ['challenge', 'perseverance', 'teamwork', 'growth']
      });
    }

    // Comedy & Joy
    const comedyMovies = movies.filter(m => 
      m.genres.includes('comedy') && m.rating > 6.5
    );

    if (comedyMovies.length > 0) {
      responses.push({
        title: 'Finding Joy in Every Moment',
        content: `Laughter is the best trail companion! Just as great comedies remind us not to take life too seriously, we believe in making every trek enjoyable and fun. Whether you're sharing stories around a campfire or laughing at the unexpected moments on the trail, joy is an essential part of the journey. Come trek with us and create memories filled with laughter! 😄`,
        summary: 'Joyful message about enjoying the trekking experience',
        type: 'general' as KnowledgeType,
        category: 'community',
        tags: ['joy', 'fun', 'laughter', 'community', 'memories']
      });
    }

    // Romance & Connection
    const romanceMovies = movies.filter(m => 
      m.genres.includes('romance') && m.rating > 7.0
    );

    if (romanceMovies.length > 0) {
      responses.push({
        title: 'Building Meaningful Connections',
        content: `Beautiful stories remind us that life's best moments are shared with others. On our treks, you'll meet fellow adventurers who share your passion for exploration. Many lifelong friendships (and even romances!) have begun on the trail. Whether you're traveling solo or with friends, you'll find a welcoming community ready to share the journey. ❤️`,
        summary: 'Content about forming connections and friendships through trekking',
        type: 'general' as KnowledgeType,
        category: 'community',
        tags: ['friendship', 'connection', 'solo travel', 'community', 'relationships']
      });
    }

    // Sci-Fi & Pushing boundaries
    const scifiMovies = movies.filter(m => 
      m.genres.includes('sci-fi') && m.rating > 7.0
    );

    if (scifiMovies.length > 0) {
      responses.push({
        title: 'Pushing Your Boundaries',
        content: `Great science fiction teaches us to dream big and push beyond our limits. Similarly, every trek is an opportunity to discover what you're truly capable of. You might surprise yourself with the heights you can reach—both literally and metaphorically! Our experienced guides ensure you can safely explore your potential. To infinity and beyond! 🚀`,
        summary: 'Inspirational message about pushing personal limits',
        type: 'general' as KnowledgeType,
        category: 'inspiration',
        tags: ['challenge', 'limits', 'potential', 'growth', 'achievement']
      });
    }

    return responses;
  }

  /**
   * Generate conversational personality traits
   */
  public generatePersonalityTraits(): Array<{
    title: string;
    content: string;
    summary: string;
    type: KnowledgeType;
    category: string;
    tags: string[];
  }> {
    return [
      {
        title: 'Encouraging and Supportive Tone',
        content: `I'm here to make your trekking experience amazing! Think of me as your enthusiastic friend who's always ready to help you find the perfect adventure. I'll celebrate your decisions, support your concerns, and guide you every step of the way. No question is too small—I'm genuinely excited to help you plan your next adventure!`,
        summary: 'AI personality trait: encouraging and supportive communication style',
        type: 'general' as KnowledgeType,
        category: 'personality',
        tags: ['tone', 'communication', 'support', 'enthusiasm']
      },
      {
        title: 'Empathetic Understanding',
        content: `I understand that planning a trek can feel overwhelming sometimes. Whether you're a first-timer feeling nervous or an experienced trekker looking for something new, I get it. I'm here to listen, understand your concerns, and help you feel confident about your choices. Your comfort and happiness matter!`,
        summary: 'AI personality trait: empathy and understanding user emotions',
        type: 'general' as KnowledgeType,
        category: 'personality',
        tags: ['empathy', 'understanding', 'emotional intelligence', 'support']
      },
      {
        title: 'Positive and Uplifting Language',
        content: `Every conversation is an opportunity to brighten your day! I love using positive language, celebrating your interest in trekking, and helping you see the exciting possibilities ahead. Even when discussing challenges or policies, I aim to present information in a way that's constructive and encouraging. Your adventure starts with our chat!`,
        summary: 'AI personality trait: positive and uplifting communication',
        type: 'general' as KnowledgeType,
        category: 'personality',
        tags: ['positivity', 'encouragement', 'optimism', 'language']
      },
      {
        title: 'Story-Driven Engagement',
        content: `Great stories inspire great adventures! I love weaving in narrative elements, using vivid descriptions, and helping you imagine your trek experience. When I describe a destination or explain a policy, I try to paint a picture that helps you connect emotionally with the information. Your trek is a story waiting to be written!`,
        summary: 'AI personality trait: storytelling and narrative engagement',
        type: 'general' as KnowledgeType,
        category: 'personality',
        tags: ['storytelling', 'narrative', 'engagement', 'description']
      }
    ];
  }

  /**
   * Generate genre-specific conversational responses
   */
  public generateGenreResponses(movies: MovieTitle[]): Array<{
    title: string;
    content: string;
    summary: string;
    type: KnowledgeType;
    category: string;
    tags: string[];
  }> {
    const responses: any[] = [];
    const genreMap: Record<string, string[]> = {};

    // Group movies by genre
    movies.forEach(movie => {
      movie.genres.forEach(genre => {
        if (!genreMap[genre]) genreMap[genre] = [];
        if (genreMap[genre].length < 5) {
          genreMap[genre].push(movie.title);
        }
      });
    });

    // Generate conversational hooks based on popular genres
    const genrePrompts: Record<string, string> = {
      action: "You seem like someone who loves action and excitement! 🎬",
      adventure: "I can tell you have an adventurous spirit! 🗺️",
      comedy: "I love your sense of fun! Let's find something amazing for you! 😄",
      drama: "You appreciate depth and meaningful experiences! 🎭",
      thriller: "You're looking for something that gets your heart racing! 🎢"
    };

    Object.entries(genrePrompts).slice(0, 5).forEach(([genre, prompt]) => {
      if (genreMap[genre]) {
        responses.push({
          title: `Conversational Hook: ${genre.charAt(0).toUpperCase() + genre.slice(1)} Enthusiast`,
          content: `${prompt} Based on your preferences, I think you'd really enjoy treks that offer ${genre === 'action' ? 'thrilling experiences and physical challenges' : genre === 'adventure' ? 'exploration and discovery' : genre === 'comedy' ? 'fun group dynamics and memorable moments' : genre === 'drama' ? 'profound natural beauty and introspection' : 'adrenaline-pumping activities'}. Let me show you some perfect matches!`,
          summary: `Conversational engagement for ${genre} enthusiasts`,
          type: 'general' as KnowledgeType,
          category: 'engagement',
          tags: ['conversation', 'personality', 'engagement', genre]
        });
      }
    });

    return responses;
  }
}

/**
 * Main training orchestrator
 */
class AITrainingService {
  private parser = new MovieDataParser();
  private generator = new ConversationalTrainingGenerator();

  public async trainAI(): Promise<{
    totalIngested: number;
    totalErrors: number;
    breakdown: Record<string, { success: number; errors: number }>;
  }> {
    logger.info('🎬 Starting AI training with movie-inspired conversational data...');

    const results = {
      totalIngested: 0,
      totalErrors: 0,
      breakdown: {} as Record<string, { success: number; errors: number }>
    };

    try {
      // Parse movie data
      logger.info('📊 Parsing movie datasets...');
      const characters = this.parser.parseCharacters();
      const movies = this.parser.parseMovieTitles();
      logger.info(`Found ${characters.length} characters and ${movies.length} movies`);

      // Generate training data
      logger.info('🎨 Generating conversational training data...');
      const upliftingResponses = this.generator.generateUpliftingResponses(movies);
      const personalityTraits = this.generator.generatePersonalityTraits();
      const genreResponses = this.generator.generateGenreResponses(movies);

      // Ingest uplifting responses
      logger.info('💫 Ingesting uplifting responses...');
      const upliftingResult = await this.ingestBatch(upliftingResponses);
      results.breakdown.uplifting = upliftingResult;
      results.totalIngested += upliftingResult.success;
      results.totalErrors += upliftingResult.errors;

      // Ingest personality traits
      logger.info('🎭 Ingesting personality traits...');
      const personalityResult = await this.ingestBatch(personalityTraits);
      results.breakdown.personality = personalityResult;
      results.totalIngested += personalityResult.success;
      results.totalErrors += personalityResult.errors;

      // Ingest genre-based responses
      logger.info('🎪 Ingesting genre-based engagement...');
      const genreResult = await this.ingestBatch(genreResponses);
      results.breakdown.genres = genreResult;
      results.totalIngested += genreResult.success;
      results.totalErrors += genreResult.errors;

      logger.info('✅ AI training completed!', results);
      return results;

    } catch (error: any) {
      logger.error('❌ Error during AI training', { error: error.message });
      throw error;
    }
  }

  private async ingestBatch(documents: any[]): Promise<{ success: number; errors: number }> {
    let success = 0;
    let errors = 0;

    for (const doc of documents) {
      try {
        const result = await this.ingestDocument(doc);
        if (result) success++;
        else errors++;
      } catch (error) {
        errors++;
        logger.error(`Failed to ingest: ${doc.title}`, { error });
      }
    }

    return { success, errors };
  }

  private async ingestDocument(doc: any): Promise<boolean> {
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

      // Generate embedding
      let embedding: number[] = [];
      if (embeddingService.isReady()) {
        try {
          const embeddingResult = await embeddingService.generateEmbedding(
            `${doc.title} ${doc.summary || doc.content.substring(0, 500)}`
          );
          embedding = embeddingResult.embedding;
        } catch (error) {
          logger.warn(`Failed to generate embedding for: ${doc.title}`);
        }
      }

      // Create document
      const knowledgeDoc = new KnowledgeBase({
        title: doc.title,
        content: doc.content,
        summary: doc.summary,
        type: doc.type,
        category: doc.category,
        tags: doc.tags,
        embedding,
        metadata: { source: 'movie_training_data' },
        relevanceScore: 1.0,
        queryCount: 0,
        isActive: true
      });

      await knowledgeDoc.save();
      logger.info(`✅ Ingested: ${doc.title}`);
      return true;

    } catch (error: any) {
      logger.error(`❌ Failed to ingest: ${doc.title}`, { error: error.message });
      return false;
    }
  }

  public async getTrainingStatus(): Promise<{
    movieInspiredDocs: number;
    totalDocs: number;
    embeddingServiceReady: boolean;
  }> {
    const movieDocs = await KnowledgeBase.countDocuments({
      isActive: true,
      'metadata.source': 'movie_training_data'
    });

    const totalDocs = await KnowledgeBase.countDocuments({ isActive: true });

    return {
      movieInspiredDocs: movieDocs,
      totalDocs,
      embeddingServiceReady: embeddingService.isReady()
    };
  }
}

// Export for use in other scripts
export const aiTrainingService = new AITrainingService();

// CLI execution
async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/trek-tribe';
    await mongoose.connect(mongoUri);
    logger.info('📦 Connected to MongoDB');

    // Run training
    const results = await aiTrainingService.trainAI();

    console.log('\n🎉 Training Complete!');
    console.log('==================');
    console.log(`✅ Total Ingested: ${results.totalIngested}`);
    console.log(`❌ Total Errors: ${results.totalErrors}`);
    console.log('\nBreakdown:');
    Object.entries(results.breakdown).forEach(([key, value]) => {
      console.log(`  ${key}: ${value.success} success, ${value.errors} errors`);
    });

    // Show status
    const status = await aiTrainingService.getTrainingStatus();
    console.log('\n📊 Current Status:');
    console.log(`  Movie-inspired docs: ${status.movieInspiredDocs}`);
    console.log(`  Total docs: ${status.totalDocs}`);
    console.log(`  Embedding service: ${status.embeddingServiceReady ? '✅ Ready' : '⚠️ Not Ready'}`);

    await mongoose.disconnect();
    process.exit(0);

  } catch (error: any) {
    console.error('❌ Training failed:', error.message);
    await mongoose.disconnect();
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}
