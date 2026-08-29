/**
 * AI policy — Sprint 9
 *
 * The decisions taken before, and instead of, calling a model. Pure functions
 * with no database and no provider, so the rules that guard spending and safety
 * can be tested without spending anything.
 *
 * O8 is unanswered: no provider has been chosen. That is why this exists first.
 * Six of the sprint's eight gate conditions are about this machinery, and every
 * one is cheaper to get right before the first invoice than after it.
 */

import crypto from 'crypto';

export type AiFeature =
  | 'trip_description'
  | 'trip_itinerary'
  | 'marketing_copy'
  | 'campaign_subject'
  | 'insight_summary';

/**
 * Whether a feature's output may be shared between organizers.
 *
 * Anything computed over one operator's own numbers is personal, whatever it
 * looks like on the surface. Getting this wrong does not produce an error - it
 * produces one organizer reading another's figures, which nobody reports
 * because it looks like an answer.
 */
export const SHAREABLE_FEATURES: Record<AiFeature, boolean> = {
  trip_description: true,
  trip_itinerary: true,
  marketing_copy: true,
  campaign_subject: true,
  // Insights are derived from the organizer's own bookings and revenue.
  insight_summary: false,
};

/**
 * Cache key: {feature}:{hash(scoped inputs)} — the gate's shape exactly.
 *
 * For a personal feature the organizer id is part of what is hashed, so two
 * operators asking the identical question get different keys and cannot read
 * each other's answer. For a shareable one it is deliberately absent, which is
 * what lets the cache actually save anything.
 *
 * Inputs are sorted before hashing so { a, b } and { b, a } are one key rather
 * than two, which is the difference between a cache and a slower database.
 */
export function cacheKey(
  feature: AiFeature,
  inputs: Record<string, unknown>,
  organizerId: string
): string {
  const shareable = SHAREABLE_FEATURES[feature];

  const scoped: Record<string, unknown> = shareable
    ? { ...inputs }
    : { ...inputs, __organizer: organizerId };

  const canonical = JSON.stringify(
    Object.keys(scoped)
      .sort()
      .map((k) => [k, scoped[k]])
  );

  const hash = crypto.createHash('sha256').update(canonical).digest('hex').slice(0, 32);
  return `${feature}:${hash}`;
}

// ─── Escalation ──────────────────────────────────────────────────────────────

/**
 * Topics that go to a human regardless of what the model concluded.
 *
 * The gate: "refund / cancellation / fraud / dispute / payment escalate
 * regardless of model verdict". The model's opinion is not consulted for these,
 * which is the point - a confident wrong answer about somebody's refund is
 * worse than no answer, and confidence is exactly what a model is good at.
 */
const ESCALATION_PATTERNS: { topic: string; test: RegExp }[] = [
  { topic: 'refund', test: /\brefunds?\b|\brefunded\b|\bmoney back\b|\bpaisa? wapas\b/i },
  { topic: 'cancellation', test: /\bcancel(l(ed|ation|ing))?\b|\bcall off\b/i },
  { topic: 'fraud', test: /\bfraud(ulent)?\b|\bscam\b|\bstolen\b|\bunauthoris(ed|ed)\b|\bunauthorized\b/i },
  { topic: 'dispute', test: /\bdispute[sd]?\b|\bchargeback\b|\bcomplaint\b/i },
  { topic: 'payment', test: /\bpayments?\b|\bcharged?\b|\bbilling\b|\binvoice\b|\bdebited\b/i },
];

export interface EscalationDecision {
  escalate: boolean;
  topics: string[];
  reason: string | null;
}

/**
 * Decide whether text must reach a human.
 *
 * Deliberately takes no model verdict as an argument. There is no parameter for
 * the model to influence, so no later change can accidentally let it - a
 * function that cannot be told the model's opinion cannot be overruled by it.
 */
export function mustEscalate(text: string): EscalationDecision {
  const topics = ESCALATION_PATTERNS.filter((p) => p.test.test(text)).map((p) => p.topic);
  if (topics.length === 0) {
    return { escalate: false, topics: [], reason: null };
  }
  return {
    escalate: true,
    topics,
    reason: `Mentions ${topics.join(', ')} — these always go to a person, whatever the model concluded.`,
  };
}

// ─── Quota ───────────────────────────────────────────────────────────────────

export interface QuotaState {
  monthlyRequestLimit: number;
  monthlyTokenLimit: number | null;
  periodMonth: string;
  requestsUsed: number;
  tokensUsed: number;
}

export type QuotaRefusalCode =
  | 'no_provider_configured'
  | 'no_quota_configured'
  | 'request_limit_reached'
  | 'token_limit_reached';

export interface QuotaDecision {
  allowed: boolean;
  code: QuotaRefusalCode | null;
  message: string | null;
}

/** The current period, as YYYY-MM. */
export function currentPeriod(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Decide whether a generation may proceed — BEFORE any provider call.
 *
 * The gate insists on that ordering, because a quota checked afterwards has
 * already spent the money it was meant to prevent.
 *
 * Both "no provider" and "no quota" refuse. Failing closed on a missing quota
 * matters as much as on a missing provider: an organizer with no configured
 * limit is not an organizer with an unlimited one, and defaulting the other way
 * is how a first invoice arrives with a number nobody expected.
 */
export function checkQuota(
  quota: QuotaState | null,
  providerConfigured: boolean,
  now: Date = new Date()
): QuotaDecision {
  if (!providerConfigured) {
    return {
      allowed: false,
      code: 'no_provider_configured',
      message:
        'No AI provider is configured, so nothing can be generated and nothing is spent. ' +
        'Choose and configure a provider first.',
    };
  }

  if (!quota) {
    return {
      allowed: false,
      code: 'no_quota_configured',
      message:
        'No AI quota is set for this organizer. A missing quota is not an unlimited one — ' +
        'set a monthly limit before generating.',
    };
  }

  // A stale period means the counters belong to a month that has ended, so this
  // month's usage is zero. Reading them as current would carry last month's
  // total forward and refuse a request that should be allowed.
  const period = currentPeriod(now);
  const requestsUsed = quota.periodMonth === period ? quota.requestsUsed : 0;
  const tokensUsed = quota.periodMonth === period ? quota.tokensUsed : 0;

  if (requestsUsed >= quota.monthlyRequestLimit) {
    return {
      allowed: false,
      code: 'request_limit_reached',
      message: `This month's limit of ${quota.monthlyRequestLimit} generations is used up.`,
    };
  }

  if (quota.monthlyTokenLimit !== null && tokensUsed >= quota.monthlyTokenLimit) {
    return {
      allowed: false,
      code: 'token_limit_reached',
      message: `This month's token allowance of ${quota.monthlyTokenLimit} is used up.`,
    };
  }

  return { allowed: true, code: null, message: null };
}
