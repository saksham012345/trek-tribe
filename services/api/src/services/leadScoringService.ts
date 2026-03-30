import { ILead } from '../models/Lead';

type ScoringMode = 'RULE_BASED' | 'ML_MODEL';

export type PriorityTier = 'hot' | 'warm' | 'cool' | 'cold';

const BASE_SCORES: Record<string, number> = {
  partial_booking: 80,
  inquiry: 60,
  chat: 50,
  form: 40,
  trip_view: 20,
  other: 10,
};

class LeadScoringService {
  private mode: ScoringMode = 'RULE_BASED';

  setMode(mode: ScoringMode) {
    this.mode = mode;
  }

  computeScore(lead: Partial<ILead>, bookingAbandonedCount = 0): number {
    if (this.mode === 'ML_MODEL') {
      return this.mlScore(lead, bookingAbandonedCount);
    }
    return this.ruleBasedScore(lead, bookingAbandonedCount);
  }

  private ruleBasedScore(lead: Partial<ILead>, bookingAbandonedCount = 0): number {
    let score = BASE_SCORES[lead.source ?? 'other'] ?? 10;

    // +10 if tripViewCount > 1
    if ((lead.metadata?.tripViewCount ?? 0) > 1) score += 10;

    // +15 if inquiryMessage present
    if (lead.metadata?.inquiryMessage) score += 15;

    // +5 per chat interaction
    const chatCount = (lead.interactions ?? []).filter(i => i.type === 'chat').length;
    score += chatCount * 5;

    // +10 if returned to same trip page multiple times (tripViewCount > 3)
    if ((lead.metadata?.tripViewCount ?? 0) > 3) score += 10;

    // +20 if clicked "Book Now" but did not finish payment
    if (bookingAbandonedCount > 0) score += 20;

    return Math.min(score, 100);
  }

  getPriorityTier(score: number): PriorityTier {
    if (score >= 75) return 'hot';
    if (score >= 50) return 'warm';
    if (score >= 25) return 'cool';
    return 'cold';
  }

  // Stub for future ML model integration
  private mlScore(lead: Partial<ILead>, bookingAbandonedCount = 0): number {
    // TODO: load trained model and run inference
    return this.ruleBasedScore(lead, bookingAbandonedCount);
  }
}

export const leadScoringService = new LeadScoringService();
