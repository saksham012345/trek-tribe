/**
 * Sprint 9 gates, tested without a provider and without spending anything.
 *
 * O8 is unanswered — no LLM has been chosen. These are the gate conditions that
 * do not need one, and they are the ones that decide how much a wrong answer
 * costs later:
 *
 *   - quota refuses BEFORE the provider call
 *   - cache key {feature}:{hash(scoped inputs)}, shareable features share and
 *     personal ones do not
 *   - refund / cancellation / fraud / dispute / payment escalate regardless of
 *     model verdict
 */

import {
  cacheKey,
  mustEscalate,
  checkQuota,
  currentPeriod,
  SHAREABLE_FEATURES,
  QuotaState,
} from '../modules/ai/aiPolicy';

const quota = (over: Partial<QuotaState> = {}): QuotaState => ({
  monthlyRequestLimit: 100,
  monthlyTokenLimit: null,
  periodMonth: currentPeriod(),
  requestsUsed: 0,
  tokensUsed: 0,
  ...over,
});

describe('AI policy', () => {
  describe('quota refuses before any provider call', () => {
    it('refuses when no provider is configured, whatever the quota says', () => {
      const d = checkQuota(quota({ monthlyRequestLimit: 1000 }), false);
      expect(d.allowed).toBe(false);
      expect(d.code).toBe('no_provider_configured');
    });

    it('refuses when no quota is configured — a missing quota is not unlimited', () => {
      const d = checkQuota(null, true);
      expect(d.allowed).toBe(false);
      expect(d.code).toBe('no_quota_configured');
      expect(d.message).toMatch(/not an unlimited one/i);
    });

    it('refuses once the request limit is reached', () => {
      const d = checkQuota(quota({ monthlyRequestLimit: 5, requestsUsed: 5 }), true);
      expect(d.allowed).toBe(false);
      expect(d.code).toBe('request_limit_reached');
    });

    it('refuses once the token limit is reached', () => {
      const d = checkQuota(
        quota({ monthlyTokenLimit: 1000, tokensUsed: 1000 }),
        true
      );
      expect(d.allowed).toBe(false);
      expect(d.code).toBe('token_limit_reached');
    });

    it('allows when a provider and headroom both exist', () => {
      expect(checkQuota(quota({ requestsUsed: 3 }), true).allowed).toBe(true);
    });

    it('treats a stale period as zero usage rather than carrying it forward', () => {
      // Counters from a month that has ended must not refuse this month.
      const d = checkQuota(
        quota({ periodMonth: '2020-01', monthlyRequestLimit: 5, requestsUsed: 5 }),
        true
      );
      expect(d.allowed).toBe(true);
    });

    it('every refusal carries a code, so the log can say why', () => {
      const refusals = [
        checkQuota(quota(), false),
        checkQuota(null, true),
        checkQuota(quota({ monthlyRequestLimit: 0 }), true),
      ];
      for (const r of refusals) {
        expect(r.allowed).toBe(false);
        expect(r.code).toBeTruthy();
        expect(r.message).toBeTruthy();
      }
    });
  });

  describe('cache key shape and scoping', () => {
    it('is {feature}:{hash}', () => {
      const k = cacheKey('marketing_copy', { a: 1 }, 'org-1');
      expect(k).toMatch(/^marketing_copy:[0-9a-f]{32}$/);
    });

    it('a shareable feature gives two organizers the SAME key', () => {
      expect(SHAREABLE_FEATURES.marketing_copy).toBe(true);
      const a = cacheKey('marketing_copy', { tripId: 't1' }, 'org-1');
      const b = cacheKey('marketing_copy', { tripId: 't1' }, 'org-2');
      expect(a).toBe(b);
    });

    it('a personal feature gives two organizers DIFFERENT keys', () => {
      expect(SHAREABLE_FEATURES.insight_summary).toBe(false);
      const a = cacheKey('insight_summary', { month: '2026-08' }, 'org-1');
      const b = cacheKey('insight_summary', { month: '2026-08' }, 'org-2');
      expect(a).not.toBe(b);
    });

    it('insights are personal — they are computed over the organizer own numbers', () => {
      expect(SHAREABLE_FEATURES.insight_summary).toBe(false);
    });

    it('input order does not change the key', () => {
      const a = cacheKey('trip_description', { x: 1, y: 2 }, 'org-1');
      const b = cacheKey('trip_description', { y: 2, x: 1 }, 'org-1');
      expect(a).toBe(b);
    });

    it('different inputs give different keys', () => {
      const a = cacheKey('trip_description', { tripId: 't1' }, 'org-1');
      const b = cacheKey('trip_description', { tripId: 't2' }, 'org-1');
      expect(a).not.toBe(b);
    });

    it('different features never collide even on identical inputs', () => {
      const a = cacheKey('trip_description', { tripId: 't1' }, 'org-1');
      const b = cacheKey('trip_itinerary', { tripId: 't1' }, 'org-1');
      expect(a).not.toBe(b);
    });
  });

  describe('escalation happens regardless of the model verdict', () => {
    const always = [
      ['refund', 'Can I get a refund for this trek?'],
      ['cancellation', 'I want to cancel my booking'],
      ['fraud', 'There is a fraudulent charge on my card'],
      ['dispute', 'I am raising a chargeback'],
      ['payment', 'My payment was debited twice'],
    ] as const;

    it.each(always)('escalates on %s', (topic, text) => {
      const d = mustEscalate(text);
      expect(d.escalate).toBe(true);
      expect(d.topics).toContain(topic);
    });

    it('says why, naming the topic', () => {
      const d = mustEscalate('I need a refund');
      expect(d.reason).toMatch(/refund/);
      expect(d.reason).toMatch(/whatever the model concluded/i);
    });

    it('catches several topics in one message', () => {
      const d = mustEscalate('My payment failed so I want to cancel and get a refund');
      expect(d.topics).toEqual(expect.arrayContaining(['payment', 'cancellation', 'refund']));
    });

    it('leaves ordinary questions alone', () => {
      expect(mustEscalate('What should I pack for the trek?').escalate).toBe(false);
      expect(mustEscalate('How difficult is this route?').escalate).toBe(false);
    });

    it('takes no model verdict as an argument, so nothing can overrule it', () => {
      // The signature is the guarantee: there is no parameter for a model
      // opinion, so a later change cannot quietly add one that suppresses this.
      expect(mustEscalate.length).toBe(1);
    });
  });

  describe('currentPeriod', () => {
    it('formats as YYYY-MM with a padded month', () => {
      expect(currentPeriod(new Date(2026, 0, 15))).toBe('2026-01');
      expect(currentPeriod(new Date(2026, 11, 1))).toBe('2026-12');
    });
  });
});
