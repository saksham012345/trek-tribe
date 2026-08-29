/**
 * AI generation — Sprint 9
 *
 * No req/res objects — pure data in, data out.
 *
 * The policy decisions live in ./aiPolicy.ts without a database or a provider,
 * so they can be tested without spending. This file is the part that reads,
 * writes and would call a model — if one were configured.
 */

import { prisma } from '../../lib/prisma';
import {
  AiFeature,
  cacheKey,
  checkQuota,
  currentPeriod,
  mustEscalate,
  SHAREABLE_FEATURES,
  QuotaState,
} from './aiPolicy';

export class AiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

// ─── The provider seam ───────────────────────────────────────────────────────

export interface ProviderResult {
  content: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  costPaise: number;
}

export interface AiProvider {
  name: string;
  generate(feature: AiFeature, inputs: Record<string, unknown>): Promise<ProviderResult>;
}

/**
 * O8 has not been answered, so there is no provider.
 *
 * This is a variable rather than a hardcoded null so that wiring one later is a
 * single assignment at startup and nothing else in this file changes. The
 * absence is the current configuration, not a missing piece of code.
 */
let provider: AiProvider | null = null;

export function configureProvider(p: AiProvider | null) {
  provider = p;
}

export function providerName(): string | null {
  return provider?.name ?? null;
}

// ─── Quota ───────────────────────────────────────────────────────────────────

export async function getQuota(organizerId: string): Promise<QuotaState | null> {
  const row = await prisma.aiQuota.findUnique({ where: { organizerId } });
  if (!row) return null;
  return {
    monthlyRequestLimit: row.monthlyRequestLimit,
    monthlyTokenLimit: row.monthlyTokenLimit,
    periodMonth: row.periodMonth,
    requestsUsed: row.requestsUsed,
    tokensUsed: row.tokensUsed,
  };
}

export async function setQuota(
  organizerId: string,
  monthlyRequestLimit: number,
  monthlyTokenLimit: number | null
) {
  if (!Number.isInteger(monthlyRequestLimit) || monthlyRequestLimit < 0) {
    throw new AiError('monthlyRequestLimit must be a non-negative integer', 400);
  }
  const data = {
    monthlyRequestLimit,
    monthlyTokenLimit,
    periodMonth: currentPeriod(),
  };
  return prisma.aiQuota.upsert({
    where: { organizerId },
    create: { organizerId, ...data },
    update: data,
  });
}

// ─── Generation ──────────────────────────────────────────────────────────────

export interface GenerateOutcome {
  status: 'cache_hit' | 'completed' | 'refused' | 'failed';
  draftId: string | null;
  content: string | null;
  refusalCode: string | null;
  message: string | null;
  cached: boolean;
}

/**
 * Generate a draft.
 *
 * The order here is the gate, and it is load-bearing:
 *
 *   1. escalation check — some topics never reach a model at all
 *   2. cache lookup    — a hit costs nothing and is logged with null tokens
 *   3. quota check     — BEFORE the provider call, never after
 *   4. provider call
 *   5. write a DRAFT   — `trips` is not touched here, ever
 *
 * Every path writes a row to ai_generation_requests, including the ones that
 * never reached a provider, because the first invoice has to reconcile against
 * this table and a missing row is indistinguishable from a billing error.
 */
export async function generate(
  organizerId: string,
  userId: string,
  feature: AiFeature,
  inputs: Record<string, unknown>,
  tripId?: string
): Promise<GenerateOutcome> {
  const key = cacheKey(feature, inputs, organizerId);

  // 1. Escalation. Checked on the inputs before anything else, so a refund
  //    question cannot reach a model even if everything else is configured.
  const promptText = JSON.stringify(inputs);
  const escalation = mustEscalate(promptText);
  if (escalation.escalate) {
    await logRequest(organizerId, userId, feature, 'refused', key, {
      refusalCode: 'escalated_to_human',
    });
    return {
      status: 'refused',
      draftId: null,
      content: null,
      refusalCode: 'escalated_to_human',
      message: escalation.reason,
      cached: false,
    };
  }

  // 2. Cache. A hit is logged as cache_hit with null tokens — the CHECK on the
  //    table refuses anything else, so this cannot quietly record a spend that
  //    did not happen.
  const hit = await prisma.aiCacheEntry.findUnique({ where: { cacheKey: key } });
  if (hit && (hit.expiresAt === null || hit.expiresAt > new Date())) {
    await prisma.aiCacheEntry.update({
      where: { id: hit.id },
      data: { hits: { increment: 1 }, lastHitAt: new Date() },
    });
    const req = await logRequest(organizerId, userId, feature, 'cache_hit', key, {});
    const draft = await prisma.aiDraft.create({
      data: { organizerId, createdBy: userId, feature, tripId, content: hit.content, requestId: req.id },
    });
    return {
      status: 'cache_hit',
      draftId: draft.id,
      content: hit.content,
      refusalCode: null,
      message: null,
      cached: true,
    };
  }

  // 3. Quota — before the call, not after.
  const quota = await getQuota(organizerId);
  const decision = checkQuota(quota, provider !== null);
  if (!decision.allowed) {
    await logRequest(organizerId, userId, feature, 'refused', key, {
      refusalCode: decision.code ?? 'refused',
    });
    return {
      status: 'refused',
      draftId: null,
      content: null,
      refusalCode: decision.code,
      message: decision.message,
      cached: false,
    };
  }

  // 4. The call. Unreachable until a provider is configured; the quota check
  //    above already refused on that, so this is the ordering being explicit
  //    rather than a second guard.
  const startedAt = Date.now();
  let result: ProviderResult;
  try {
    result = await provider!.generate(feature, inputs);
  } catch (e: any) {
    await logRequest(organizerId, userId, feature, 'failed', key, {
      provider: provider!.name,
      errorText: String(e?.message ?? e).slice(0, 500),
      latencyMs: Date.now() - startedAt,
    });
    return {
      status: 'failed',
      draftId: null,
      content: null,
      refusalCode: null,
      message: 'The provider did not answer. Nothing was saved.',
      cached: false,
    };
  }

  const req = await logRequest(organizerId, userId, feature, 'completed', key, {
    provider: result.provider,
    model: result.model,
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    costPaise: result.costPaise,
    latencyMs: Date.now() - startedAt,
  });

  // Usage counts against the quota only when a provider was actually called.
  await prisma.aiQuota.update({
    where: { organizerId },
    data: {
      requestsUsed: { increment: 1 },
      tokensUsed: { increment: result.promptTokens + result.completionTokens },
      periodMonth: currentPeriod(),
    },
  });

  const shareable = SHAREABLE_FEATURES[feature];
  await prisma.aiCacheEntry.create({
    data: {
      cacheKey: key,
      feature,
      shareable,
      organizerId: shareable ? null : organizerId,
      content: result.content,
      provider: result.provider,
      model: result.model,
    },
  });

  // 5. A draft. `trips` is not touched.
  const draft = await prisma.aiDraft.create({
    data: {
      organizerId, createdBy: userId, feature, tripId,
      content: result.content, requestId: req.id,
    },
  });

  return {
    status: 'completed',
    draftId: draft.id,
    content: result.content,
    refusalCode: null,
    message: null,
    cached: false,
  };
}

async function logRequest(
  organizerId: string,
  userId: string,
  feature: AiFeature,
  status: 'cache_hit' | 'completed' | 'refused' | 'failed',
  cacheKeyValue: string,
  extra: Record<string, unknown>
) {
  return prisma.aiGenerationRequest.create({
    data: { organizerId, userId, feature, status, cacheKey: cacheKeyValue, ...extra } as any,
  });
}

// ─── Drafts ──────────────────────────────────────────────────────────────────

export async function listDrafts(organizerId: string) {
  return prisma.aiDraft.findMany({
    where: { organizerId, acceptedAt: null, discardedAt: null },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

/**
 * Accept a draft.
 *
 * This is the only thing in Sprint 9 that mutates a trip, and it does so
 * through the ordinary update — same ownership check, same validation, same
 * audit trail as a human edit. Generating produced a row somebody could ignore;
 * accepting is a person deciding, and it is recorded as one.
 */
export async function acceptDraft(draftId: string, organizerId: string, acceptedBy: string) {
  const draft = await prisma.aiDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.organizerId !== organizerId) throw new AiError('Draft not found', 404);
  if (draft.acceptedAt) throw new AiError('This draft has already been accepted', 409);
  if (draft.discardedAt) throw new AiError('This draft was discarded', 409);

  if (draft.tripId) {
    const trip = await prisma.trip.findUnique({
      where: { id: draft.tripId },
      select: { organizerId: true },
    });
    if (!trip || trip.organizerId !== organizerId) throw new AiError('Not your trip', 403);

    const field =
      draft.feature === 'trip_itinerary' ? { itinerary: draft.content }
      : draft.feature === 'trip_description' ? { description: draft.content }
      : null;

    if (!field) {
      throw new AiError('This kind of draft does not apply to a trip', 400);
    }

    await prisma.trip.update({ where: { id: draft.tripId }, data: field });
  }

  return prisma.aiDraft.update({
    where: { id: draftId },
    data: { acceptedAt: new Date(), acceptedBy },
  });
}

export async function discardDraft(draftId: string, organizerId: string) {
  const draft = await prisma.aiDraft.findUnique({ where: { id: draftId } });
  if (!draft || draft.organizerId !== organizerId) throw new AiError('Draft not found', 404);
  if (draft.acceptedAt) throw new AiError('This draft has already been accepted', 409);
  return prisma.aiDraft.update({ where: { id: draftId }, data: { discardedAt: new Date() } });
}

// ─── Spend ───────────────────────────────────────────────────────────────────

export async function getSpend(organizerId: string) {
  const rows = await prisma.$queryRaw<any[]>`
    SELECT period, provider, attempts, provider_calls, cache_hits, refused, failed,
           prompt_tokens, completion_tokens, cost_paise
    FROM v_ai_spend_by_month
    WHERE organizer_id = ${organizerId}
    ORDER BY period DESC
  `;
  return rows.map((r) => ({
    period: r.period,
    provider: r.provider,
    attempts: Number(r.attempts),
    providerCalls: Number(r.provider_calls),
    cacheHits: Number(r.cache_hits),
    refused: Number(r.refused),
    failed: Number(r.failed),
    // Null rather than 0 when nothing was ever sent — the same distinction the
    // table keeps, carried out to the API.
    promptTokens: r.prompt_tokens === null ? null : Number(r.prompt_tokens),
    completionTokens: r.completion_tokens === null ? null : Number(r.completion_tokens),
    costPaise: Number(r.cost_paise),
  }));
}
