import { EmbeddingService } from './embeddingService';

// Small curated general-knowledge corpus for travel-related Q&A (used when external AI is not configured)
const GENERAL_DOCS = [
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
    if (best && best.sim > 0.4) {
      const doc = GENERAL_DOCS.find(d => d.id === best.id)!;
      return { response: doc.text, source: doc.title };
    }
    // If no good match, return a generic helpful travel tip
    return { response: "Here are some general travel tips: check weather and road conditions before travel, pack appropriate clothing and first-aid, prefer guided groups for remote treks, and carry emergency contacts.", source: 'generic' };
  } catch (err: any) {
    return { response: "I can't access the knowledge base right now. Try again later or connect with an agent.", source: 'error' };
  }
}
