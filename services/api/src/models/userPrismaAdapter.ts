/**
 * A Mongoose-shaped façade over the Prisma `users` table.
 *
 * D10 says unify on Postgres. The `users` table has been in Neon since wave 9,
 * but 74 files and 311 call sites still read through the Mongoose model, so the
 * application runs on two databases — which is exactly the thing D10 set out to
 * end, and which surfaced the moment Docker was down and Mongo was gone.
 *
 * Rewriting 311 call sites at once would be one enormous change across the auth
 * path, reviewable by nobody. This instead presents the twelve methods those
 * call sites actually use, backed by Prisma, so files move over one at a time
 * and each move is a one-line import change that the end-to-end suite can
 * check.
 *
 * What it deliberately does NOT do:
 *
 *   - aggregate(). Five call sites use Mongo aggregation pipelines, which do
 *     not translate mechanically to SQL. Pretending otherwise would produce
 *     wrong numbers rather than an error, so it throws and names the caller.
 *   - Mongoose documents. Rows come back as plain objects, always. There is no
 *     .save(), no virtuals, no middleware. A caller relying on those should be
 *     ported properly rather than accommodated.
 */

import { prisma } from '../lib/prisma';

type Doc = Record<string, any>;

/** Mongo filter operators seen in this codebase, translated to Prisma. */
function translateValue(value: any): any {
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value)) return { in: value };

  const out: Record<string, any> = {};
  let translated = false;

  for (const [op, operand] of Object.entries(value)) {
    switch (op) {
      case '$in': out.in = operand; translated = true; break;
      case '$nin': out.notIn = operand; translated = true; break;
      case '$ne': out.not = operand; translated = true; break;
      case '$gt': out.gt = operand; translated = true; break;
      case '$gte': out.gte = operand; translated = true; break;
      case '$lt': out.lt = operand; translated = true; break;
      case '$lte': out.lte = operand; translated = true; break;
      case '$exists':
        // "exists" on a nullable column is "is not null", which is the only
        // sense it ever had here.
        out.not = operand ? null : undefined;
        if (!operand) out.equals = null;
        translated = true;
        break;
      case '$regex': {
        const src = operand instanceof RegExp ? operand.source : String(operand);
        // Anchors and wildcards do not survive a translation to `contains`, and
        // a silently different match is worse than a refusal.
        if (/[\^\$\[\]\(\)\{\}\|\\\+\?]/.test(src)) {
          throw new Error(
            `User query: the regex /${src}/ cannot be translated to Prisma safely. ` +
            `Port this call site by hand.`
          );
        }
        out.contains = src;
        out.mode = 'insensitive';
        translated = true;
        break;
      }
      default:
        break;
    }
  }

  return translated ? out : value;
}

function translateFilter(filter: Doc = {}): Doc {
  const where: Doc = {};

  for (const [key, value] of Object.entries(filter)) {
    if (key === '_id') {
      where.id = translateValue(value);
      continue;
    }
    if (key === '$or' || key === '$and') {
      where[key.slice(1).toUpperCase() === 'OR' ? 'OR' : 'AND'] =
        (value as Doc[]).map(translateFilter);
      continue;
    }
    if (key.includes('.')) {
      throw new Error(
        `User query: nested path "${key}" has no column. Port this call site by hand.`
      );
    }
    where[key] = translateValue(value);
  }

  return where;
}

/** `select('-passwordHash')` and `select('name email')`, as Prisma select. */
/**
 * Every column organizerProfile is built from.
 *
 * Five call sites select dotted paths — "organizerProfile.bio",
 * "organizerProfile.autoPay", "organizerProfile.trustScore" — which were passed
 * to Prisma verbatim and rejected, so each of them answered 500. Opening any
 * trip from Discover was one of them: the page loads the organizer with
 * "name profilePhoto organizerProfile.bio ...", and every trip detail page in
 * the app failed on it.
 *
 * Asking for any nested path selects the whole set and lets nestOrganizerProfile
 * rebuild the shape. That reads a few more columns than the caller asked for,
 * which is the honest trade against mapping every sub-path — autoPay and
 * trustScore are objects spanning several columns each.
 */
const ORGANIZER_PROFILE_COLUMNS = [
  'organizerBio', 'organizerExperience', 'specialties', 'certifications', 'languages',
  'yearsOfExperience', 'totalTripsOrganized', 'organizerAchievements', 'companyName',
  'licenseNumber', 'verificationBadge', 'routingEnabled',
  'autoPaySetupRequired', 'autoPaySetupCompleted', 'autoPayEnabled',
  'trustScoreOverall', 'trustScoreLastCalculated', 'trustDocumentVerified',
  'trustBankVerified', 'trustExperienceYears', 'trustCompletedTrips',
  'trustUserReviews', 'trustResponseTime', 'trustRefundRate',
];
function translateSelect(spec: string | Doc | undefined): Doc | undefined {
  if (!spec) return undefined;

  if (typeof spec === 'object') {
    const out: Doc = {};
    for (const [k, v] of Object.entries(spec)) out[k === '_id' ? 'id' : k] = Boolean(v);
    return out;
  }

  const fields = spec.split(/\s+/).filter(Boolean);
  const excluded = fields.filter((f) => f.startsWith('-')).map((f) => f.slice(1));
  const included = fields.filter((f) => !f.startsWith('-'));

  if (included.length) {
    const out: Doc = { id: true };
    for (const f of included) {
      if (f.startsWith('organizerProfile.')) {
        for (const c of ORGANIZER_PROFILE_COLUMNS) out[c] = true;
        continue;
      }
      if (f.includes('.')) {
        throw new Error(
          `Cannot select the nested path "${f}". Only organizerProfile.* is rebuilt from columns; ` +
            'everything else was flattened with a different name. Select the column instead.'
        );
      }
      out[f === '_id' ? 'id' : f] = true;
    }
    return out;
  }

  // Exclusion. Prisma has no "everything except", so the omitted fields are
  // stripped after the read rather than in the query — same result, one more
  // column over the wire.
  return { __exclude: excluded } as Doc;
}

function applyExclusion(row: Doc | null, select: Doc | undefined): Doc | null {
  if (!row || !select?.__exclude) return row;
  const out = { ...row };
  for (const f of select.__exclude as string[]) delete out[f];
  return out;
}

/**
 * Flatten the nested objects callers still write.
 *
 * Wave 9 flattened organizerProfile, preferences and notification settings into
 * columns. Callers were never updated, and Mongoose accepted the nested shape
 * silently — strict mode drops paths it does not know, so trustScore,
 * verificationBadge and routingEnabled have been written into nothing on every
 * registration since. That is the same class of bug wave 9 documented.
 *
 * Prisma refuses instead, loudly, which is how this surfaced. Rather than edit
 * every caller at once, the shape is translated here and the callers move when
 * they are touched for other reasons.
 */
function flattenNested(data: Doc): Doc {
  const out: Doc = { ...data };

  const op = out.organizerProfile;
  if (op && typeof op === 'object') {
    delete out.organizerProfile;

    if (op.bio !== undefined) out.organizerBio = op.bio;
    if (op.experience !== undefined) out.organizerExperience = op.experience;
    if (op.specialties !== undefined) out.specialties = op.specialties;
    if (op.certifications !== undefined) out.certifications = op.certifications;
    if (op.languages !== undefined) out.languages = op.languages;
    if (op.yearsOfExperience !== undefined) out.yearsOfExperience = op.yearsOfExperience;
    if (op.totalTripsOrganized !== undefined) out.totalTripsOrganized = op.totalTripsOrganized;
    if (op.achievements !== undefined) out.organizerAchievements = op.achievements;
    if (op.companyName !== undefined) out.companyName = op.companyName;
    if (op.licenseNumber !== undefined) out.licenseNumber = op.licenseNumber;
    if (op.verificationBadge !== undefined) out.verificationBadge = op.verificationBadge;
    if (op.routingEnabled !== undefined) out.routingEnabled = op.routingEnabled;

    const ap = op.autoPay;
    if (ap && typeof ap === 'object') {
      if (ap.isSetupRequired !== undefined) out.autoPaySetupRequired = ap.isSetupRequired;
      if (ap.isSetupCompleted !== undefined) out.autoPaySetupCompleted = ap.isSetupCompleted;
      if (ap.autoPayEnabled !== undefined) out.autoPayEnabled = ap.autoPayEnabled;
    }

    const ts = op.trustScore;
    if (ts && typeof ts === 'object') {
      if (ts.overall !== undefined) out.trustScoreOverall = ts.overall;
      if (ts.lastCalculated !== undefined) out.trustScoreLastCalculated = ts.lastCalculated;
      const b = ts.breakdown;
      if (b && typeof b === 'object') {
        if (b.documentVerified !== undefined) out.trustDocumentVerified = b.documentVerified;
        if (b.bankVerified !== undefined) out.trustBankVerified = b.bankVerified;
        if (b.experienceYears !== undefined) out.trustExperienceYears = b.experienceYears;
        if (b.completedTrips !== undefined) out.trustCompletedTrips = b.completedTrips;
        if (b.userReviews !== undefined) out.trustUserReviews = b.userReviews;
        if (b.responseTime !== undefined) out.trustResponseTime = b.responseTime;
        if (b.refundRate !== undefined) out.trustRefundRate = b.refundRate;
      }
    }

    // qrCodes is a related table, not a column. Dropped here rather than passed
    // through, because a create with a bare array would fail on a relation.
    delete out.qrCodes;
  }

  const prefs = out.preferences;
  if (prefs && typeof prefs === 'object') {
    delete out.preferences;
    const n = prefs.notifications;
    if (n && typeof n === 'object') {
      if (n.email !== undefined) out.notifyEmail = n.email;
      if (n.sms !== undefined) out.notifySms = n.sms;
      if (n.push !== undefined) out.notifyPush = n.push;
      if (n.tripUpdates !== undefined) out.notifyTripUpdates = n.tripUpdates;
      if (n.promotions !== undefined) out.notifyPromotions = n.promotions;
    }
  }

  // Mongoose ignored these; Postgres has no column for them either. Dropping
  // them keeps the write working without pretending they are stored.
  delete out._id;
  delete out.__v;

  return out;
}

/**
 * Rows carry `_id` as well as `id`.
 *
 * The frontend and 300-odd call sites read `_id`; wave 4 already learned that
 * dropping it breaks the app in ways nothing typechecks. Both are present and
 * hold the same value.
 */
/**
 * The inverse of flattenNested, for reading.
 *
 * flattenNested was built so callers could keep *writing* the nested shape.
 * Nothing was built for reading it back, so every caller that reads
 * `user.organizerProfile.something` has been getting undefined since wave 9:
 *
 *   trips.service      autoPay gate -> every organizer got 402 "AutoPay
 *                      required" when creating a trip, including ones an admin
 *                      had just enabled, because the admin write set the column
 *                      and the read never looked at it
 *   crmAccess          the same check -> CRM refused everyone
 *   bankDetails        organizerProfile?.bankDetails -> always "not found"
 *
 * Attached non-enumerable, for the reason save() is: it must not appear in JSON
 * responses or in save()'s change detection. A fresh object every read would
 * never compare equal to the original, so an enumerable one would make every
 * save() rewrite the whole profile.
 *
 * Only built from columns the row actually has, so a .select() that omitted
 * them yields undefined rather than a confidently wrong `false`.
 */
function nestOrganizerProfile(row: Doc): Doc | undefined {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(row, k);
  const set = (o: Doc, k: string, col: string) => { if (has(col)) o[k] = row[col]; };

  const op: Doc = {};
  set(op, 'bio', 'organizerBio');
  set(op, 'experience', 'organizerExperience');
  set(op, 'specialties', 'specialties');
  set(op, 'certifications', 'certifications');
  set(op, 'languages', 'languages');
  set(op, 'yearsOfExperience', 'yearsOfExperience');
  set(op, 'totalTripsOrganized', 'totalTripsOrganized');
  set(op, 'achievements', 'organizerAchievements');
  set(op, 'companyName', 'companyName');
  set(op, 'licenseNumber', 'licenseNumber');
  set(op, 'verificationBadge', 'verificationBadge');
  set(op, 'routingEnabled', 'routingEnabled');

  const ap: Doc = {};
  set(ap, 'isSetupRequired', 'autoPaySetupRequired');
  set(ap, 'isSetupCompleted', 'autoPaySetupCompleted');
  set(ap, 'autoPayEnabled', 'autoPayEnabled');
  if (Object.keys(ap).length) op.autoPay = ap;

  const ts: Doc = {};
  set(ts, 'overall', 'trustScoreOverall');
  set(ts, 'lastCalculated', 'trustScoreLastCalculated');
  const bd: Doc = {};
  set(bd, 'documentVerified', 'trustDocumentVerified');
  set(bd, 'bankVerified', 'trustBankVerified');
  set(bd, 'experienceYears', 'trustExperienceYears');
  set(bd, 'completedTrips', 'trustCompletedTrips');
  set(bd, 'userReviews', 'trustUserReviews');
  set(bd, 'responseTime', 'trustResponseTime');
  set(bd, 'refundRate', 'trustRefundRate');
  if (Object.keys(bd).length) ts.breakdown = bd;
  if (Object.keys(ts).length) op.trustScore = ts;

  return Object.keys(op).length ? op : undefined;
}

function shape(row: Doc | null): Doc | null {
  if (!row) return null;

  const doc: Doc = { ...row, _id: row.id };

  // A working .save().
  //
  // Fifty call sites across sixteen files read a user, assign a field, and call
  // save() — auth.ts alone has twenty-one. Rewriting all of them at once would
  // be a large change to the auth path with no way to review it in pieces, so
  // the row carries a save() that writes back what actually changed.
  //
  // Only changed fields are written. A blind update of every field would
  // clobber a column another request had written in between, and would turn a
  // one-field edit into a whole-row overwrite.
  //
  // Non-enumerable so it does not appear in JSON responses, Object.keys, or a
  // spread — a save function serialised into an API response would be both
  // noise and a small disclosure of how this works.
  const original = { ...row };

  // Read-side organizerProfile. See nestOrganizerProfile: without this, every
  // caller reading a nested path got undefined, and the autoPay gate refused
  // every organizer.
  const nested = nestOrganizerProfile(row);
  if (nested) {
    Object.defineProperty(doc, 'organizerProfile', {
      enumerable: false,
      configurable: true,
      writable: true,
      value: nested,
    });
  }

  Object.defineProperty(doc, 'save', {
    enumerable: false,
    writable: false,
    value: async function save() {
      const changed: Doc = {};
      for (const [key, value] of Object.entries(doc)) {
        if (key === '_id' || key === 'id') continue;
        if (value !== original[key]) changed[key] = value;
      }
      if (Object.keys(changed).length === 0) return doc;

      const updated = await prisma.user.update({
        where: { id: doc.id },
        data: flattenNested(changed) as any,
      });
      Object.assign(original, updated);
      return shape(updated as Doc);
    },
  });

  // toObject() and toJSON() appear where a Mongoose document was expected.
  // Both are the row itself here.
  Object.defineProperty(doc, 'toObject', {
    enumerable: false,
    value: () => ({ ...doc }),
  });
  Object.defineProperty(doc, 'toJSON', {
    enumerable: false,
    value: () => ({ ...doc }),
  });

  return doc;
}

export interface QueryOptions {
  select?: Doc;
  orderBy?: Doc;
  take?: number;
  skip?: number;
}

/**
 * A thenable that also answers the Mongoose query modifiers these call sites
 * use: .select(), .lean(), .sort(), .limit(), .skip().
 *
 * Returned as `any` so existing call sites keep their shape without 300 casts.
 * The behaviour is checked by verify-user-adapter and the end-to-end suite
 * rather than by the type system, which is the honest trade for a façade whose
 * whole purpose is to look like something it is not.
 */
function query<T>(run: (opts: QueryOptions) => Promise<T>): any {
  const opts: QueryOptions = {};

  const chain: any = {
    select(spec: string | Doc) {
      opts.select = translateSelect(spec);
      return chain;
    },
    lean() {
      // Rows are already plain objects. lean() is a no-op that exists so call
      // sites do not have to change.
      return chain;
    },
    sort(spec: Doc) {
      // { createdAt: -1 } becomes { createdAt: 'desc' }.
      const orderBy: Doc = {};
      for (const [k, v] of Object.entries(spec)) {
        orderBy[k === '_id' ? 'id' : k] = Number(v) < 0 ? 'desc' : 'asc';
      }
      opts.orderBy = orderBy;
      return chain;
    },
    limit(n: number) {
      opts.take = n;
      return chain;
    },
    skip(n: number) {
      opts.skip = n;
      return chain;
    },
    // Typed so Promise.all resolves this to `any` rather than `unknown`.
    // Without the explicit signature TypeScript cannot see through the
    // thenable, and every call site inside a Promise.all loses its shape.
    then<R1 = any, R2 = never>(
      onFulfilled?: ((value: any) => R1 | PromiseLike<R1>) | null,
      onRejected?: ((reason: any) => R2 | PromiseLike<R2>) | null
    ): Promise<R1 | R2> {
      return run(opts).then(onFulfilled as any, onRejected as any) as Promise<R1 | R2>;
    },
    catch(onRejected?: ((reason: any) => any) | null) {
      return run(opts).catch(onRejected as any);
    },
  };

  return chain;
}

// Returned as `any` because Prisma's generated argument types treat `select`
// as present-or-absent at the type level, and this decides at runtime. The
// shape is checked by the end-to-end suite instead.
// Returned as `any` because Prisma's generated argument types treat select,
// orderBy, take and skip as present-or-absent at the type level, and this
// decides at runtime.
const args = (opts: QueryOptions): any => ({
  ...(opts.select && !opts.select.__exclude ? { select: opts.select } : {}),
  ...(opts.orderBy ? { orderBy: opts.orderBy } : {}),
  ...(opts.take !== undefined ? { take: opts.take } : {}),
  ...(opts.skip !== undefined ? { skip: opts.skip } : {}),
});

export const UserPrisma = {
  /**
   * Mongoose accepts a projection as a second argument as well as via
   * .select(); both forms appear in this codebase, so both are honoured.
   */
  findById(id: string, projection?: string | Doc): any {
    const q = query(async (opts) => {
      if (!id) return null;
      const row = await prisma.user.findUnique({ where: { id }, ...args(opts) });
      return shape(applyExclusion(row as Doc, opts.select));
    });
    return projection ? q.select(projection) : q;
  },

  findOne(filter: Doc = {}, projection?: string | Doc): any {
    const q = query(async (opts) => {
      const row = await prisma.user.findFirst({
        where: translateFilter(filter),
        ...args(opts),
      });
      return shape(applyExclusion(row as Doc, opts.select));
    });
    return projection ? q.select(projection) : q;
  },

  find(filter: Doc = {}, projection?: string | Doc): any {
    const q = query(async (opts) => {
      const rows = await prisma.user.findMany({
        where: translateFilter(filter),
        ...args(opts),
      });
      return rows.map((r) => shape(applyExclusion(r as Doc, opts.select))) as Doc[];
    });
    return projection ? q.select(projection) : q;
  },

  async countDocuments(filter: Doc = {}) {
    return prisma.user.count({ where: translateFilter(filter) });
  },

  // Returns `any` rather than `Doc | Doc[]`. Call sites read .name and ._id
  // straight off the result, and a union would make every one of them narrow
  // for a case they never hit. An object literal cannot carry overload
  // signatures, so this is the honest way to say "shaped like what you passed".
  async create(data: Doc | Doc[]): Promise<any> {
    if (Array.isArray(data)) {
      const made = await Promise.all(data.map((d) => prisma.user.create({ data: flattenNested(d) as any })));
      return made.map((m) => shape(m as Doc));
    }
    const made = await prisma.user.create({ data: flattenNested(data) as any });
    return shape(made as Doc);
  },

  async insertMany(rows: Doc[]): Promise<any[]> {
    return this.create(rows);
  },

  // Chainable, because call sites write
  // findByIdAndUpdate(...).select('-passwordHash') — the updated row goes
  // straight into a response and the hash must not travel with it.
  findByIdAndUpdate(id: string, update: Doc, _opts?: Doc): any {
    return query(async (opts) => {
      // $set is the only update operator these call sites use; anything else
      // would change values in a way this cannot express, so it is refused.
      const data = flattenNested(update.$set ?? update);
      for (const key of Object.keys(update)) {
        if (key.startsWith('$') && key !== '$set') {
          throw new Error(
            `User update: operator ${key} is not supported by this adapter. ` +
            `Port this call site by hand.`
          );
        }
      }
      const row = await prisma.user.update({
        where: { id },
        data: data as any,
        ...(opts.select && !opts.select.__exclude ? { select: opts.select } : {}),
      } as any);
      return shape(applyExclusion(row as Doc, opts.select));
    });
  },

  async updateMany(filter: Doc, update: Doc) {
    const data = flattenNested(update.$set ?? update);
    return prisma.user.updateMany({ where: translateFilter(filter), data: data as any });
  },

  async deleteMany(filter: Doc = {}) {
    return prisma.user.deleteMany({ where: translateFilter(filter) });
  },

  async findByIdAndDelete(id: string) {
    const row = await prisma.user.delete({ where: { id } });
    return shape(row as Doc);
  },

  async findOneAndDelete(filter: Doc) {
    const found = await prisma.user.findFirst({ where: translateFilter(filter) });
    if (!found) return null;
    const row = await prisma.user.delete({ where: { id: found.id } });
    return shape(row as Doc);
  },

  /**
   * Users grouped by role, with counts.
   *
   * All five User.aggregate call sites in this codebase were the same pipeline —
   * group by role, count, sometimes sort. Giving that one shape a name is better
   * than a general aggregate translator: the query is stated once, and the four
   * callers that copied it stop being four chances to get it subtly different.
   *
   * Sorted by count descending, which is what the one caller that sorted asked
   * for and the others did not care about.
   */
  async groupByRole(): Promise<{ role: string; count: number }[]> {
    const rows = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
    });
    return rows
      .map((r) => ({ role: String(r.role), count: r._count.role }))
      .sort((a, b) => b.count - a.count);
  },

  /**
   * Not implemented, on purpose.
   *
   * Every aggregation this codebase actually ran is now groupByRole above.
   * Anything else needs real SQL: a half-translation would return numbers that
   * look plausible and are wrong, which is worse than nothing working — so this
   * refuses loudly and names what to do instead.
   */
  aggregate(_pipeline: Doc[]): never {
    throw new Error(
      'User.aggregate is not supported by the Prisma adapter. Mongo aggregation ' +
      'pipelines do not translate mechanically to SQL, and a partial translation ' +
      'returns plausible wrong numbers. Write this query as prisma.$queryRaw or ' +
      'a view, the way the Sprint 3 analytics views were done.'
    );
  },
};

export default UserPrisma;
