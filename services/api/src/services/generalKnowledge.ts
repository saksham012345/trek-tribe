import { EmbeddingService } from './embeddingService';

// Enhanced general-knowledge corpus for travel AND general world queries
const GENERAL_DOCS = [
  // Travel-specific knowledge
  {
    id: 'g1',
    title: 'Packing for monsoon treks',
    text: 'Packing checklist for monsoon treks: waterproof jacket, breathable quick-dry layers, waterproof trekking shoes, gaiters, rain covers for backpack and electronics, extra socks, quick-dry towel, compact first-aid, water purification tablets, power bank, headlamp, and zip-lock bags for keeping documents dry.'
  },
  {
    id: 'g2',
    title: 'Safety tips for solo female travellers',
    text: 'Safety tips: prefer guided groups, avoid isolated areas at night, inform someone about your itinerary, carry emergency contacts and a power bank, respect local customs, acclimatize properly at high altitudes, and keep photocopies of ID. For high altitude, monitor symptoms of AMS and descend if severe.'
  },
  {
    id: 'g3',
    title: 'How to modify a booking',
    text: 'To modify a booking: open your TrekTribe account, go to My Bookings, select the booking and choose Modify (if within allowed time window). For payments via UPI, modifications may require contacting support if payment settlement has completed; contact support with your booking id and payment reference.'
  },
  {
    id: 'g4',
    title: 'Hidden winter gems in India',
    text: 'Hidden winter gems: Tawang (Arunachal Pradesh) for monasteries and snow vistas, Ziro Valley (Arunachal) for cultural experiences and mild winters, and Spiti Valley (Himachal) for high-altitude winter landscapes and unique villages. Check road access and prepare for cold temperatures.'
  },
  
  // General world knowledge
  {
    id: 'w1',
    title: 'World Geography and Travel',
    text: 'Popular travel destinations include: Paris (France) for art and culture, Tokyo (Japan) for technology and tradition, Bali (Indonesia) for beaches and temples, Iceland for natural wonders like glaciers and northern lights, Peru for Machu Picchu and ancient history, New Zealand for adventure sports and landscapes, and Dubai (UAE) for modern architecture and luxury.'
  },
  {
    id: 'w2',
    title: 'Climate and Weather Information',
    text: 'Best times to visit: Europe (May-September for warm weather), Southeast Asia (November-February for dry season), India (October-March for most regions, June-September for monsoon lovers), Africa safaris (June-October dry season), South America (varies by region - December-March for Argentina/Chile, June-August for Peru), Japan (March-May for cherry blossoms, October-November for autumn colors).'
  },
  {
    id: 'w3',
    title: 'Cultural and Historical Knowledge',
    text: 'Famous landmarks: Eiffel Tower (Paris), Great Wall (China), Taj Mahal (India), Colosseum (Rome), Statue of Liberty (USA), Christ the Redeemer (Brazil), Petra (Jordan), Machu Picchu (Peru), Pyramids of Giza (Egypt), Angkor Wat (Cambodia), Stonehenge (UK), Acropolis (Greece). Each offers unique historical and cultural significance.'
  },
  {
    id: 'w4',
    title: 'Travel Requirements and Documentation',
    text: 'International travel basics: Valid passport (6 months validity), visa requirements vary by country and nationality, travel insurance recommended, vaccinations may be required (yellow fever, COVID-19, etc.), currency exchange or international cards, emergency contact information, copies of important documents, and knowledge of local customs and laws.'
  },
  {
    id: 'w5',
    title: 'World Cuisines and Food',
    text: 'Famous cuisines: Italian (pizza, pasta, gelato), Japanese (sushi, ramen, tempura), Indian (curry, biryani, tandoori), French (croissants, cheese, wine), Mexican (tacos, guacamole), Thai (pad thai, curries), Chinese (dim sum, noodles), Mediterranean (olive oil, fresh vegetables), and American (burgers, BBQ). Each region offers unique flavors and cooking techniques.'
  },
  {
    id: 'w6',
    title: 'Languages and Communication',
    text: 'Most spoken languages: English (global business), Mandarin Chinese (1.3B speakers), Spanish (500M+ speakers), Hindi (600M+ speakers), Arabic (300M+ speakers), French (280M speakers), Bengali, Portuguese, Russian, and Japanese. English is widely used for international travel. Learning basic phrases helps: hello, thank you, please, excuse me, where is, how much.'
  },
  {
    id: 'w7',
    title: 'Technology and Modern Life',
    text: 'Modern technology includes: smartphones for communication and navigation, internet for information and booking, social media for sharing experiences, GPS for directions, translation apps for language barriers, digital payments and cryptocurrency, cloud storage for photos, AI assistants for help, renewable energy innovations, electric vehicles, and space exploration advances.'
  },
  {
    id: 'w8',
    title: 'Current Events and Global Topics',
    text: 'Major global topics include: climate change and sustainability, renewable energy adoption, artificial intelligence and automation, space exploration (Mars missions, commercial spaceflight), global health initiatives, economic development, digital transformation, cultural exchange, wildlife conservation, and international cooperation on shared challenges.'
  },
  {
    id: 'w9',
    title: 'Science and Nature',
    text: 'Natural wonders: Amazon rainforest (biodiversity), Great Barrier Reef (coral ecosystem), Mount Everest (highest peak 8,849m), Grand Canyon (geological marvel), Victoria Falls (massive waterfall), Aurora Borealis/Northern Lights (natural light display), Sahara Desert (largest hot desert), Antarctica (frozen continent), and diverse ecosystems supporting millions of species.'
  },
  {
    id: 'w10',
    title: 'Sports and Entertainment',
    text: 'Popular sports: Football/Soccer (World Cup), Cricket (IPL, World Cup), Basketball (NBA), Tennis (Grand Slams), Olympics (summer and winter), Formula 1 racing, Golf, Rugby, Baseball, and Athletics. Entertainment includes movies, music, theater, festivals, concerts, gaming, streaming platforms, and cultural events worldwide.'
  },
  {
    id: 'w11',
    title: 'Health and Wellness',
    text: 'Health tips: balanced diet with fruits and vegetables, regular exercise (30 min daily), adequate sleep (7-8 hours), hydration (8 glasses water), stress management through meditation or yoga, regular health checkups, mental health awareness, avoiding smoking and excessive alcohol, maintaining hygiene, and staying informed about health guidelines.'
  },
  {
    id: 'w12',
    title: 'Education and Learning',
    text: 'Learning resources: universities and colleges for formal education, online platforms (Coursera, edX, Khan Academy), books and libraries, YouTube tutorials, podcasts, professional certifications, workshops and seminars, language learning apps (Duolingo), coding bootcamps, and lifelong learning opportunities. Education opens doors to career growth and personal development.'
  }
];

const embSvc = new EmbeddingService();

let docEmbeddings: { id: string; embedding: number[] }[] = [];

async function ensureEmbeddings() {
  if (docEmbeddings.length > 0) return;
  // compute embeddings for docs (uses OpenAI if configured, else TF-IDF fallback)
  const results = await Promise.all(GENERAL_DOCS.map(d => embSvc.generateEmbedding(d.text)));
  docEmbeddings = results.map((r, i) => ({ id: GENERAL_DOCS[i].id, embedding: r.embedding }));
}

function cosineSim(a: number[], b: number[]) {
  const dot = a.reduce((s, v, i) => s + v * (b[i] || 0), 0);
  const na = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const nb = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  if (na === 0 || nb === 0) return 0;
  return dot / (na * nb);
}

export async function answerGeneralQuery(query: string) {
  await ensureEmbeddings();
  try {
    const qEmb = (await embSvc.generateEmbedding(query)).embedding;
    const sims = docEmbeddings.map(d => ({ id: d.id, sim: cosineSim(qEmb, d.embedding) }));
    sims.sort((a, b) => b.sim - a.sim);
    const best = sims[0];
    
    // Lower threshold to 0.2 to catch more general queries
    if (best && best.sim > 0.2) {
      const doc = GENERAL_DOCS.find(d => d.id === best.id)!;
      return { response: doc.text, source: doc.title };
    }
    
    // If no good match, provide intelligent fallback based on query type
    const lowerQuery = query.toLowerCase();
    
    // Travel-related fallback
    if (lowerQuery.includes('travel') || lowerQuery.includes('trip') || lowerQuery.includes('destination')) {
      return { 
        response: "I can help you with travel planning! Popular destinations include mountain treks in the Himalayas, beach getaways in Goa, cultural tours in Rajasthan, and adventure trips across India. You can also ask me about world destinations, climate information, or travel requirements.", 
        source: 'travel_fallback' 
      };
    }
    
    // World knowledge fallback
    if (lowerQuery.includes('world') || lowerQuery.includes('country') || lowerQuery.includes('city') || lowerQuery.includes('geography')) {
      return { 
        response: "I have knowledge about world geography, famous landmarks, different cultures, languages, cuisines, and travel destinations worldwide. Feel free to ask about specific countries, cities, or cultural topics!", 
        source: 'world_fallback' 
      };
    }
    
    // Technology/science fallback
    if (lowerQuery.includes('technology') || lowerQuery.includes('science') || lowerQuery.includes('ai') || lowerQuery.includes('space')) {
      return { 
        response: "Modern technology includes AI, smartphones, internet, renewable energy, electric vehicles, and space exploration. Science covers nature, climate, ecosystems, and discoveries. I can provide general information about these topics!", 
        source: 'tech_fallback' 
      };
    }
    
    // Health/wellness fallback
    if (lowerQuery.includes('health') || lowerQuery.includes('fitness') || lowerQuery.includes('wellness') || lowerQuery.includes('exercise')) {
      return { 
        response: "For health and wellness: maintain a balanced diet with fruits and vegetables, exercise regularly (30 minutes daily), get adequate sleep (7-8 hours), stay hydrated, manage stress through meditation or yoga, and schedule regular health checkups. These basics contribute to overall wellbeing!", 
        source: 'health_fallback' 
      };
    }
    
    // General fallback
    return { 
      response: "I'm here to help! I can answer questions about travel destinations, world geography, cultures, technology, health, education, and general knowledge. I also specialize in helping you find and book amazing trips. What would you like to know?", 
      source: 'generic' 
    };
  } catch (err: any) {
    return { 
      response: "I'm having trouble accessing my knowledge base right now, but I'm still here to help! You can ask me about trips, destinations, or general questions, and I'll do my best to assist you.", 
      source: 'error' 
    };
  }
}
