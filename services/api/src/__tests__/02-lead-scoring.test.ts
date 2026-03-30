/**
 * LeadScoringService Unit Tests
 * Covers: base scores, bonus signals, score cap, priority tiers, ML stub
 * Requirements: 4.1–4.9
 */
import { describe, it, expect, beforeEach } from '@jest/globals';
import { leadScoringService } from '../services/leadScoringService';

// Reset mode before each test
beforeEach(() => {
  leadScoringService.setMode('RULE_BASED');
});

describe('LeadScoringService — base scores by source', () => {
  const cases: [string, number][] = [
    ['partial_booking', 80],
    ['inquiry', 60],
    ['chat', 50],
    ['form', 40],
    ['trip_view', 20],
    ['other', 10],
  ];

  for (const [source, expected] of cases) {
    it(`source "${source}" → base score ${expected}`, () => {
      const score = leadScoringService.computeScore({ source: source as any });
      expect(score).toBe(expected);
    });
  }

  it('unknown source defaults to 10', () => {
    const score = leadScoringService.computeScore({ source: 'unknown' as any });
    expect(score).toBe(10);
  });
});

describe('LeadScoringService — bonus signals', () => {
  it('+10 when tripViewCount > 1', () => {
    const score = leadScoringService.computeScore({
      source: 'form',
      metadata: { tripViewCount: 2 },
    });
    expect(score).toBe(40 + 10); // 50
  });

  it('no bonus when tripViewCount === 1', () => {
    const score = leadScoringService.computeScore({
      source: 'form',
      metadata: { tripViewCount: 1 },
    });
    expect(score).toBe(40);
  });

  it('+15 when inquiryMessage is present', () => {
    const score = leadScoringService.computeScore({
      source: 'form',
      metadata: { inquiryMessage: 'I am interested' },
    });
    expect(score).toBe(40 + 15); // 55
  });

  it('no bonus when inquiryMessage is empty string', () => {
    const score = leadScoringService.computeScore({
      source: 'form',
      metadata: { inquiryMessage: '' },
    });
    expect(score).toBe(40);
  });

  it('+5 per chat interaction', () => {
    const score = leadScoringService.computeScore({
      source: 'form',
      interactions: [
        { type: 'chat', description: 'msg1', timestamp: new Date() },
        { type: 'chat', description: 'msg2', timestamp: new Date() },
      ],
    });
    expect(score).toBe(40 + 10); // 50
  });

  it('non-chat interactions do not add bonus', () => {
    const score = leadScoringService.computeScore({
      source: 'form',
      interactions: [
        { type: 'email', description: 'email1', timestamp: new Date() },
      ],
    });
    expect(score).toBe(40);
  });

  it('+10 additional when tripViewCount > 3', () => {
    // tripViewCount=4: +10 (>1) + +10 (>3) = +20
    const score = leadScoringService.computeScore({
      source: 'form',
      metadata: { tripViewCount: 4 },
    });
    expect(score).toBe(40 + 10 + 10); // 60
  });

  it('+20 when bookingAbandonedCount > 0', () => {
    const score = leadScoringService.computeScore({ source: 'form' }, 1);
    expect(score).toBe(40 + 20); // 60
  });

  it('stacks all bonuses correctly', () => {
    const score = leadScoringService.computeScore(
      {
        source: 'inquiry', // 60
        metadata: { tripViewCount: 4, inquiryMessage: 'interested' }, // +10 +10 +15
        interactions: [
          { type: 'chat', description: 'c1', timestamp: new Date() },
          { type: 'chat', description: 'c2', timestamp: new Date() },
        ], // +10
      },
      1 // +20
    );
    // 60 + 10 + 15 + 10 + 10 + 20 = 125 → capped at 100
    expect(score).toBe(100);
  });
});

describe('LeadScoringService — score cap', () => {
  it('caps score at 100 regardless of bonuses', () => {
    const score = leadScoringService.computeScore(
      {
        source: 'partial_booking', // 80
        metadata: { tripViewCount: 5, inquiryMessage: 'yes' }, // +10 +10 +15
      },
      2 // +20
    );
    expect(score).toBe(100);
  });

  it('score is never negative', () => {
    const score = leadScoringService.computeScore({ source: 'other' });
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe('LeadScoringService — priority tiers', () => {
  it('score 75–100 → hot', () => {
    expect(leadScoringService.getPriorityTier(75)).toBe('hot');
    expect(leadScoringService.getPriorityTier(100)).toBe('hot');
    expect(leadScoringService.getPriorityTier(90)).toBe('hot');
  });

  it('score 50–74 → warm', () => {
    expect(leadScoringService.getPriorityTier(50)).toBe('warm');
    expect(leadScoringService.getPriorityTier(74)).toBe('warm');
    expect(leadScoringService.getPriorityTier(60)).toBe('warm');
  });

  it('score 25–49 → cool', () => {
    expect(leadScoringService.getPriorityTier(25)).toBe('cool');
    expect(leadScoringService.getPriorityTier(49)).toBe('cool');
    expect(leadScoringService.getPriorityTier(40)).toBe('cool');
  });

  it('score 0–24 → cold', () => {
    expect(leadScoringService.getPriorityTier(0)).toBe('cold');
    expect(leadScoringService.getPriorityTier(24)).toBe('cold');
    expect(leadScoringService.getPriorityTier(10)).toBe('cold');
  });
});

describe('LeadScoringService — ML mode stub', () => {
  it('ML mode falls back to rule-based scoring', () => {
    leadScoringService.setMode('ML_MODEL');
    const score = leadScoringService.computeScore({ source: 'inquiry' });
    expect(score).toBe(60);
  });
});
