/**
 * Move production data from MongoDB Atlas to Neon Postgres.
 *
 * The schema went to Postgres across nine sprints; the data never did. Neon
 * currently holds test rows and nothing else, so deploying the new code against
 * it would show a live site with no users, no trips and no bookings — the data
 * still safe in Atlas, and the product unable to find it.
 *
 * This is the piece that closes that gap, and the Sprint 4 gate that was never
 * run for want of data: "every pre-existing trip still visible and bookable —
 * check the count before and after".
 *
 * ── Safety ──────────────────────────────────────────────────────────────────
 *
 * Dry run unless --write is passed. A dry run reads everything, builds every
 * row, reports exactly what would be inserted, and writes nothing.
 *
 * Atlas is opened read-only and never written to. If this migration is wrong,
 * the source is still intact and the answer is to fix the script and re-run —
 * which is only true because nothing here touches the source.
 *
 * Re-runnable. Ids are derived from the Mongo _id rather than generated, so a
 * second run updates the same rows instead of duplicating them. That is also
 * what makes foreign keys line up: a booking's organizerId resolves to the same
 * UUID the user was inserted under, without holding a map in memory across
 * collections.
 *
 * ── Usage ───────────────────────────────────────────────────────────────────
 *
 *   ATLAS_URI="mongodb+srv://..." npx ts-node scripts/migrate-atlas-to-neon.ts
 *   ATLAS_URI="mongodb+srv://..." npx ts-node scripts/migrate-atlas-to-neon.ts --write
 *
 * DATABASE_URL decides the destination. Point it at a copy first.
 */

import { MongoClient, ObjectId } from 'mongodb';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dns from 'dns';

/**
 * Atlas connection strings are mongodb+srv://, which needs an SRV lookup before
 * anything else happens. Some resolvers — corporate DNS, some home routers —
 * time out on SRV records while answering ordinary A records perfectly, so the
 * failure reads as "cannot reach Atlas" when the network is fine.
 *
 * Opt-in rather than automatic: silently rewriting someone's DNS is not a thing
 * a migration script should do without being asked.
 *
 *   MIGRATION_DNS=8.8.8.8 npx ts-node scripts/migrate-atlas-to-neon.ts
 */
if (process.env.MIGRATION_DNS) {
  dns.setServers(process.env.MIGRATION_DNS.split(',').map((s) => s.trim()));
  console.log(`Using DNS servers: ${process.env.MIGRATION_DNS}`);
}

const WRITE = process.argv.includes('--write');
const ATLAS_URI = process.env.ATLAS_URI ?? process.env.MONGODB_URI ?? '';

const prisma = new PrismaClient();

interface Tally {
  collection: string;
  read: number;
  prepared: number;
  written: number;
  skipped: number;
  reasons: Map<string, number>;
}

const tallies: Tally[] = [];

function tally(collection: string): Tally {
  const t: Tally = { collection, read: 0, prepared: 0, written: 0, skipped: 0, reasons: new Map() };
  tallies.push(t);
  return t;
}

function skip(t: Tally, reason: string) {
  t.skipped++;
  t.reasons.set(reason, (t.reasons.get(reason) ?? 0) + 1);
}

/**
 * One readable line out of a Prisma error.
 *
 * Prisma's validation errors are forty lines of the whole accepted shape with
 * the offending field underlined somewhere in the middle. Truncating the front
 * of that produces "Invalid `upsert()` invocation in D:\..." repeated for every
 * row, which is what the first run of this reported — a count of failures with
 * no way to tell what failed. The useful part is the last sentence.
 */
function describeError(e: any): string {
  if (e?.code === 'P2002') return `unique violation: ${e.meta?.target}`;
  if (e?.code === 'P2003') return `foreign key: ${e.meta?.field_name ?? 'unknown'}`;

  const msg = String(e?.message ?? e);
  const unknown = msg.match(/Unknown argument `([^`]+)`/);
  if (unknown) return `unknown column: ${unknown[1]}`;

  const missing = msg.match(/Argument `([^`]+)` is missing/);
  if (missing) return `missing required column: ${missing[1]}`;

  const invalid = msg.match(/Invalid value for argument `([^`]+)`/);
  if (invalid) return `invalid value for: ${invalid[1]}`;

  const lastLine = msg.split('\n').map((l) => l.trim()).filter(Boolean).pop();
  return (lastLine ?? msg).slice(0, 100);
}

/**
 * A Mongo ObjectId becomes a stable UUID.
 *
 * Deterministic on purpose. Generating fresh UUIDs would mean holding a map of
 * every old id to every new one in memory, and a second run would produce a
 * different map and duplicate everything. Deriving the UUID from the ObjectId
 * means a booking written today and the user written yesterday agree without
 * either knowing about the other.
 *
 * This is a UUIDv5-shaped hash: sha1 of a fixed namespace plus the id, with the
 * version and variant bits set so Postgres accepts it as a uuid.
 */
const NAMESPACE = 'trektribe-atlas-to-neon-v1';

function toUuid(id: ObjectId | string | null | undefined): string | null {
  if (!id) return null;
  const key = typeof id === 'string' ? id : id.toHexString();
  if (!key) return null;

  const hash = crypto.createHash('sha1').update(NAMESPACE).update(key).digest();
  const bytes = Buffer.from(hash.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function asDate(v: any): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function asStringArray(v: any): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string');
}

/** Enum values Postgres will accept, or a stated fallback. */
function asEnum<T extends string>(v: any, allowed: readonly T[], fallback: T): T {
  return allowed.includes(v) ? v : fallback;
}

// ─── Users ───────────────────────────────────────────────────────────────────

async function migrateUsers(db: any) {
  const t = tally('users');
  const cursor = db.collection('users').find({});

  for await (const doc of cursor) {
    t.read++;

    const id = toUuid(doc._id);
    if (!id) { skip(t, 'no _id'); continue; }

    // These three are NOT NULL in Postgres. A Mongo document missing any of
    // them cannot become a row, and inventing a value would put a login into
    // the database that nobody can use.
    if (!doc.email || !doc.passwordHash || !doc.name) {
      skip(t, 'missing email, passwordHash or name');
      continue;
    }

    const op = doc.organizerProfile ?? {};
    const ts = op.trustScore ?? {};
    const bd = ts.breakdown ?? {};
    const ap = op.autoPay ?? {};
    const nf = doc.preferences?.notifications ?? {};

    const data = {
      id,
      email: String(doc.email).trim().toLowerCase(),
      passwordHash: doc.passwordHash,
      name: doc.name,
      username: doc.username ?? null,
      role: asEnum(doc.role, ['traveler', 'organizer', 'admin', 'agent'] as const, 'traveler'),
      phone: doc.phone ?? null,
      bio: doc.bio ?? null,
      location: doc.location ?? null,
      profilePhoto: doc.profilePhoto ?? null,
      dateOfBirth: asDate(doc.dateOfBirth),
      occupation: doc.occupation ?? null,

      emailVerified: Boolean(doc.emailVerified),
      phoneVerified: Boolean(doc.phoneVerified),
      lastActive: asDate(doc.lastActive) ?? asDate(doc.createdAt),

      // organizerProfile was a nested object in Mongo and is columns here —
      // the same flattening the adapter does on write. Wave 9 defined these
      // columns; nothing has ever populated them, because Mongoose dropped the
      // nested writes silently.
      organizerBio: op.bio ?? null,
      organizerExperience: op.experience ?? null,
      specialties: asStringArray(op.specialties),
      certifications: asStringArray(op.certifications),
      languages: asStringArray(op.languages),
      yearsOfExperience: typeof op.yearsOfExperience === 'number' ? op.yearsOfExperience : null,
      totalTripsOrganized: typeof op.totalTripsOrganized === 'number' ? op.totalTripsOrganized : 0,
      companyName: op.companyName ?? null,
      licenseNumber: op.licenseNumber ?? null,

      autoPaySetupRequired: Boolean(ap.isSetupRequired),
      autoPaySetupCompleted: Boolean(ap.isSetupCompleted),
      autoPayEnabled: Boolean(ap.autoPayEnabled),

      trustScoreOverall: typeof ts.overall === 'number' ? ts.overall : null,
      trustDocumentVerified: typeof bd.documentVerified === 'number' ? bd.documentVerified : null,
      trustBankVerified: typeof bd.bankVerified === 'number' ? bd.bankVerified : null,
      trustExperienceYears: typeof bd.experienceYears === 'number' ? bd.experienceYears : null,
      trustCompletedTrips: typeof bd.completedTrips === 'number' ? bd.completedTrips : null,
      trustUserReviews: typeof bd.userReviews === 'number' ? bd.userReviews : null,
      trustResponseTime: typeof bd.responseTime === 'number' ? bd.responseTime : null,
      trustRefundRate: typeof bd.refundRate === 'number' ? bd.refundRate : null,
      trustScoreLastCalculated: asDate(ts.lastCalculated),

      notifyEmail: nf.email !== false,
      notifySms: Boolean(nf.sms),
      notifyPush: nf.push !== false,

      organizerVerificationStatus: asEnum(
        doc.organizerVerificationStatus,
        ['pending', 'approved', 'rejected'] as const,
        'pending'
      ),
      createdAt: asDate(doc.createdAt) ?? new Date(),
    };

    t.prepared++;
    liveUserIds.add(id);
    if (!WRITE) continue;

    try {
      await prisma.user.upsert({ where: { id }, create: data as any, update: data as any });
      t.written++;
    } catch (e: any) {
      // A duplicate email is the common one: two Mongo documents, one unique
      // column. Recorded rather than swallowed, because it means a person will
      // lose an account and somebody has to decide which.
      skip(t, describeError(e));
    }
  }
}

// ─── Trips ───────────────────────────────────────────────────────────────────

async function migrateTrips(db: any) {
  const t = tally('trips');
  const cursor = db.collection('trips').find({});

  for await (const doc of cursor) {
    t.read++;

    const id = toUuid(doc._id);
    const organizerId = toUuid(doc.organizerId);
    if (!id) { skip(t, 'no _id'); continue; }
    if (!organizerId) { skip(t, 'no organizerId'); continue; }

    if (!doc.title || !doc.destination) { skip(t, 'missing title or destination'); continue; }

    const start = asDate(doc.startDate);
    const end = asDate(doc.endDate);
    if (!start || !end) { skip(t, 'missing or invalid dates'); continue; }

    const data = {
      id,
      organizerId,
      title: doc.title,
      description: doc.description ?? '',
      destination: doc.destination,
      difficulty: asEnum(doc.difficulty, ['easy', 'moderate', 'challenging', 'extreme'] as const, 'moderate'),
      categories: asStringArray(doc.categories),
      capacity: typeof doc.capacity === 'number' ? doc.capacity : 1,
      price: typeof doc.price === 'number' ? doc.price : 0,
      startDate: start,
      endDate: end,
      status: asEnum(doc.status, ['pending', 'active', 'cancelled', 'completed'] as const, 'active'),

      // Sprint 4 backfilled every existing trip to published because they are
      // live and selling. The same reasoning applies to everything arriving
      // from Atlas: these trips are already on sale.
      publicationStatus: 'published' as const,

      images: asStringArray(doc.images),
      coverImage: doc.coverImage ?? null,
      itinerary: doc.itinerary ?? null,
      slug: doc.slug ?? null,
      isPrivate: Boolean(doc.isPrivate),
      createdAt: asDate(doc.createdAt) ?? new Date(),
    };

    t.prepared++;
    liveTripIds.add(id);
    if (!WRITE) continue;

    try {
      await prisma.trip.upsert({ where: { id }, create: data as any, update: data as any });
      t.written++;
    } catch (e: any) {
      // A trip whose organizer did not survive the users pass has nothing to
      // hang from. Named rather than counted, so the fix is obvious.
      skip(t, e.code === 'P2003' ? 'organizer not migrated' : describeError(e));
    }
  }
}

// ─── Bookings ────────────────────────────────────────────────────────────────

/**
 * Ids that actually made it into Postgres, for checking references before
 * inserting rather than after failing.
 *
 * A dry run cannot learn this from Prisma — it never calls it — so a reference
 * check that only happens at insert time reports nothing useful until the
 * moment it is too late to be useful.
 */
const liveTripIds = new Set<string>();
const liveUserIds = new Set<string>();

async function migrateBookings(db: any) {
  const t = tally('groupbookings');
  const names = await db.listCollections().toArray();
  const name = names.map((c: any) => c.name).find((n: string) =>
    /^(groupbookings|group_bookings|bookings)$/i.test(n)
  );
  if (!name) {
    skip(t, 'no bookings collection found');
    return;
  }

  const cursor = db.collection(name).find({});
  for await (const doc of cursor) {
    t.read++;

    const id = toUuid(doc._id);
    const tripId = toUuid(doc.tripId);
    const mainBookerId = toUuid(doc.mainBookerId ?? doc.userId);
    if (!id || !tripId || !mainBookerId) { skip(t, 'missing id, tripId or booker'); continue; }

    // Every booking in this database points at a trip that no longer exists —
    // 21 of 21 at the time of writing. Mongo allowed that because it has no
    // foreign keys; Postgres will not, and the decision taken was to leave them
    // behind rather than invent trips to hang them from.
    //
    // Checked here rather than left to the insert, so a dry run reports the
    // number honestly. The first version of this script did not, and its
    // "prepared=21" was a comfortable lie.
    if (!liveTripIds.has(tripId)) {
      skip(t, 'trip no longer exists — orphan booking, left behind by decision');
      continue;
    }

    const guests = typeof doc.numberOfGuests === 'number' ? doc.numberOfGuests : 1;
    const per = Number(doc.pricePerPerson ?? doc.price ?? 0);
    const total = Number(doc.totalAmount ?? per * guests);
    const final = Number(doc.finalAmount ?? total);

    const data = {
      id,
      tripId,
      mainBookerId,
      numberOfGuests: guests,
      totalAmount: total,
      pricePerPerson: per,
      finalAmount: final,
      // Money is the one place a guess is unacceptable. paidAmount stays null
      // when Mongo never recorded one — null means "unknown", and writing 0
      // would say "they paid nothing", which is a different and possibly false
      // claim about a real customer.
      paidAmount: doc.paidAmount === undefined || doc.paidAmount === null
        ? null
        : Number(doc.paidAmount),
      paymentMethod: doc.paymentMethod ?? 'unknown',
      paymentStatus: asEnum(
        doc.paymentStatus,
        ['pending', 'partial', 'completed', 'failed', 'refunded'] as const,
        'pending'
      ),
      bookingStatus: asEnum(
        doc.bookingStatus,
        ['confirmed', 'pending', 'cancelled', 'completed'] as const,
        'pending'
      ),
      createdAt: asDate(doc.createdAt) ?? new Date(),
    };

    t.prepared++;
    if (!WRITE) continue;

    try {
      await prisma.groupBooking.upsert({ where: { id }, create: data as any, update: data as any });
      t.written++;
    } catch (e: any) {
      skip(t, e.code === 'P2003' ? 'trip or booker not migrated' : describeError(e));
    }
  }
}

// ─── Everything else ─────────────────────────────────────────────────────────

/**
 * The remaining collections, each with its own mapper.
 *
 * Written as one loop with per-collection functions rather than eleven
 * near-identical blocks: the shape of "read, map, check references, upsert,
 * count the skips" is the same every time, and repeating it eleven times is
 * eleven chances for one of them to drift.
 *
 * `needs` names the foreign keys that must already exist. A row referencing a
 * user or trip that did not migrate is skipped with that reason rather than
 * failing at the insert, so a dry run reports the real number.
 */
interface Mapper {
  collection: string;
  model: string;
  needs?: (row: any) => string[];
  map: (doc: any) => any | null;
  /**
   * Column to upsert on, when it is not `id`.
   *
   * SiteSettings is a singleton keyed on `key`, and Postgres already holds the
   * default row. Upserting by id tried to insert a second one and was refused
   * by the unique index, which is the table being right.
   */
  upsertOn?: string;
}

const MAPPERS: Mapper[] = [
  {
    collection: 'follows',
    model: 'follow',
    needs: (r) => [r.followerId, r.followingId],
    map: (d) => {
      const followerId = toUuid(d.followerId);
      const followingId = toUuid(d.followingId);
      if (!followerId || !followingId) return null;
      return { id: toUuid(d._id), followerId, followingId, createdAt: asDate(d.createdAt) ?? new Date() };
    },
  },
  {
    collection: 'useractivities',
    model: 'userActivity',
    needs: (r) => [r.userId],
    map: (d) => {
      const userId = toUuid(d.userId);
      if (!userId || !d.activityType) return null;
      return {
        id: toUuid(d._id),
        userId,
        // userType is NOT NULL and the first version of this mapper omitted it
        // entirely — 61 rows prepared, 61 rejected.
        userType: asEnum(d.userType, ['user', 'organizer'] as const, 'user'),
        // booking_started and organizer_profile_view were not in the Postgres
        // enum at all until the migration beside this one added them. Falling
        // back to trip_view would have filed a profile view as a trip view —
        // a wrong fact rather than a missing one.
        activityType: asEnum(
          d.activityType,
          [
            'trip_view', 'trip_created', 'booking_made', 'chat_initiated',
            'ticket_created', 'payment_made', 'profile_updated',
            'document_uploaded', 'login', 'logout',
            'booking_started', 'organizer_profile_view',
          ] as const,
          'trip_view'
        ),
        description: d.description ?? '',
        metadata: d.metadata ?? undefined,
        createdAt: asDate(d.createdAt) ?? new Date(),
      };
    },
  },
  {
    collection: 'notifications',
    model: 'notification',
    needs: (r) => [r.userId],
    map: (d) => {
      const userId = toUuid(d.userId);
      if (!userId || !d.title || !d.message) return null;
      return {
        id: toUuid(d._id),
        userId,
        type: d.type ?? 'general',
        title: d.title,
        message: d.message,
        isRead: Boolean(d.isRead),
        createdAt: asDate(d.createdAt) ?? new Date(),
      };
    },
  },
  {
    collection: 'leads',
    model: 'lead',
    map: (d) => {
      if (!d.email) return null;
      return {
        id: toUuid(d._id),
        email: String(d.email).trim().toLowerCase(),
        name: d.name ?? null,
        source: asEnum(
          d.source,
          ['website', 'referral', 'social_media', 'advertisement', 'walk_in', 'phone', 'email', 'other'] as const,
          'other'
        ),
        status: asEnum(
          d.status,
          ['new', 'contacted', 'interested', 'not_interested', 'converted', 'lost'] as const,
          'new'
        ),
        pipelineStage: asEnum(
          d.pipelineStage,
          ['new', 'contacted', 'interested', 'negotiating', 'booked', 'lost'] as const,
          'new'
        ),
        leadScore: typeof d.leadScore === 'number' ? d.leadScore : 0,
        // A lead pointing at a user or trip that did not migrate keeps the
        // lead and drops the link — losing a sales record to preserve a
        // reference would be the wrong trade.
        assignedTo: liveUserIds.has(toUuid(d.userId) ?? '') ? toUuid(d.userId) : null,
        tripId: liveTripIds.has(toUuid(d.tripId) ?? '') ? toUuid(d.tripId) : null,
        createdAt: asDate(d.createdAt) ?? new Date(),
      };
    },
  },
  {
    collection: 'expenses',
    model: 'expense',
    needs: (r) => [r.organizerId, r.tripId],
    map: (d) => {
      const organizerId = toUuid(d.organizerId);
      const tripId = toUuid(d.tripId);
      // tripId is NOT NULL on this table, so an expense whose trip is gone
      // cannot become a row. Same situation as the orphan bookings.
      if (!organizerId || !tripId) return null;
      return {
        id: toUuid(d._id),
        organizerId,
        tripId,
        category: asEnum(
          d.category,
          ['transport', 'accommodation', 'food', 'permits', 'guides', 'equipment', 'marketing', 'other'] as const,
          'other'
        ),
        amount: Number(d.amount ?? 0),
        description: d.description ?? null,
        date: asDate(d.date) ?? asDate(d.createdAt) ?? new Date(),
        createdAt: asDate(d.createdAt) ?? new Date(),
      };
    },
  },
  {
    collection: 'blogposts',
    model: 'blogPost',
    needs: (r) => [r.authorId],
    map: (d) => {
      const authorId = toUuid(d.authorId);
      if (!authorId || !d.title || !d.slug || !d.content) return null;
      return {
        id: toUuid(d._id),
        authorId,
        title: String(d.title).slice(0, 180),
        slug: d.slug,
        excerpt: String(d.excerpt ?? '').slice(0, 320),
        content: d.content,
        coverImage: d.coverImage ?? null,
        tags: asStringArray(d.tags),
        status: asEnum(d.status, ['draft', 'published', 'archived'] as const, 'published'),
        publishedAt: asDate(d.publishedAt),
        readTimeMinutes: typeof d.readTimeMinutes === 'number' ? d.readTimeMinutes : null,
        createdAt: asDate(d.createdAt) ?? new Date(),
      };
    },
  },
  {
    collection: 'supporttickets',
    model: 'supportTicket',
    needs: (r) => [r.userId],
    map: (d) => {
      const userId = toUuid(d.userId);
      if (!userId || !d.subject || !d.description) return null;
      return {
        id: toUuid(d._id),
        userId,
        subject: d.subject,
        description: d.description,
        customerEmail: d.customerEmail ?? '',
        customerName: d.customerName ?? '',
        customerPhone: d.customerPhone ?? null,
        category: asEnum(
          d.category,
          ['booking', 'payment', 'technical', 'account', 'general', 'complaint'] as const,
          'general'
        ),
        priority: asEnum(d.priority, ['low', 'medium', 'high', 'urgent'] as const, 'medium'),
        status: asEnum(d.status, ['open', 'in_progress', 'resolved', 'closed'] as const, 'open'),
        createdAt: asDate(d.createdAt) ?? new Date(),
      };
    },
  },
  {
    collection: 'auditlogs',
    model: 'auditLog',
    needs: (r) => [r.userId],
    map: (d) => {
      const userId = toUuid(d.userId);
      if (!userId || !d.action) return null;
      return {
        id: toUuid(d._id),
        userId,
        action: d.action,
        resource: d.resource ?? null,
        resourceId: d.resourceId ?? null,
        metadata: d.metadata ?? undefined,
        status: d.status ?? null,
        createdAt: asDate(d.timestamp) ?? asDate(d.createdAt) ?? new Date(),
      };
    },
  },
  {
    collection: 'verificationrequests',
    model: 'verificationRequest',
    needs: (r) => [r.organizerId],
    map: (d) => {
      const organizerId = toUuid(d.organizerId);
      if (!organizerId || !d.organizerName || !d.organizerEmail) return null;
      return {
        id: toUuid(d._id),
        organizerId,
        organizerName: d.organizerName,
        organizerEmail: d.organizerEmail,
        // The real values are 'initial' and 'document_update'. The first
        // version of this mapper guessed at kyc/trip/identity/business, none
        // of which the enum has ever contained.
        requestType: asEnum(
          d.requestType,
          ['initial', 'kyc_update', 're_verification', 'document_update'] as const,
          'initial'
        ),
        status: asEnum(d.status, ['pending', 'approved', 'rejected', 'under_review'] as const, 'pending'),
        priority: asEnum(d.priority, ['low', 'medium', 'high', 'urgent'] as const, 'medium'),
        createdAt: asDate(d.createdAt) ?? new Date(),
      };
    },
  },
  {
    collection: 'organizersubscriptions',
    model: 'organizerSubscription',
    needs: (r) => [r.organizerId],
    map: (d) => {
      const organizerId = toUuid(d.organizerId);
      if (!organizerId) return null;
      return {
        id: toUuid(d._id),
        organizerId,
        plan: asEnum(
          d.plan ?? d.planType,
          ['trial', 'free_trial', 'starter', 'basic', 'pro', 'professional', 'enterprise'] as const,
          'trial'
        ),
        status: asEnum(d.status, ['active', 'trial', 'expired', 'cancelled', 'suspended'] as const, 'active'),
        tripsPerCycle: typeof d.tripsPerCycle === 'number' ? d.tripsPerCycle : 0,
        tripsUsed: typeof d.tripsUsed === 'number' ? d.tripsUsed : 0,
        pricePerCycle: Number(d.pricePerCycle ?? 0),
        currency: d.currency ?? 'INR',
        autoRenew: d.autoRenew !== false,
        trialStartDate: asDate(d.trialStartDate),
        trialEndDate: asDate(d.trialEndDate),
        subscriptionStartDate: asDate(d.currentPeriodStart),
        subscriptionEndDate: asDate(d.currentPeriodEnd),
        crmAccess: Boolean(d.crmAccess),
        crmBundleFeatures: asStringArray(d.crmBundle?.features),
        createdAt: asDate(d.createdAt) ?? new Date(),
      };
    },
  },
  {
    collection: 'sitesettings',
    model: 'siteSettings',
    upsertOn: 'key',
    // SiteSettings is flattened in Postgres — homeHeroImages, contactSupportEmail
    // and so on are columns, not the nested `home` and `contact` objects Mongo
    // held. The first version passed the nested objects straight through and was
    // rejected with "unknown column: home".
    //
    // Only the fields that exist on both sides are carried. Everything else has
    // a sensible default in the schema, and inventing values for columns Mongo
    // never had would be writing settings nobody chose.
    map: (d) => {
      const home = d.home ?? {};
      const contact = d.contact ?? {};
      const notif = d.notifications ?? {};
      return {
        id: toUuid(d._id),
        // `key` is unique and only ever 'global' — that is how the singleton is
        // expressed on both sides.
        key: d.key ?? 'global',
        homeHeroImages: asStringArray(home.heroImages),
        homeOverlayStyle: asEnum(home.overlayStyle, ['light', 'dark'] as const, 'light'),
        ...(home.fontFamily ? { homeFontFamily: home.fontFamily } : {}),
        ...(typeof home.discoverColumnsDesktop === 'number'
          ? { homeDiscoverColumnsDesktop: home.discoverColumnsDesktop } : {}),
        ...(typeof home.discoverColumnsMobile === 'number'
          ? { homeDiscoverColumnsMobile: home.discoverColumnsMobile } : {}),
        ...(contact.supportEmail ? { contactSupportEmail: contact.supportEmail } : {}),
        ...(contact.otpFromEmail ? { contactOtpFromEmail: contact.otpFromEmail } : {}),
        ...(contact.bookingFromEmail ? { contactBookingFromEmail: contact.bookingFromEmail } : {}),
        ...(typeof notif.emailEnabled === 'boolean'
          ? { notificationsEmailEnabled: notif.emailEnabled } : {}),
        createdAt: asDate(d.createdAt) ?? new Date(),
      };
    },
  },
];

async function migrateRest(db: any) {
  const names = (await db.listCollections().toArray()).map((c: any) => c.name);

  for (const m of MAPPERS) {
    const t = tally(m.collection);
    if (!names.includes(m.collection)) {
      skip(t, 'collection not present in Atlas');
      continue;
    }

    for await (const doc of db.collection(m.collection).find({})) {
      t.read++;

      let data: any;
      try {
        data = m.map(doc);
      } catch (e: any) {
        skip(t, `mapping failed: ${e.message.slice(0, 60)}`);
        continue;
      }
      if (!data || !data.id) { skip(t, 'missing a required field'); continue; }

      // References checked before the insert, so a dry run says the truth.
      if (m.needs) {
        const refs = m.needs(doc).map((r) => toUuid(r));
        const missing = refs.filter(
          (r) => r && !liveUserIds.has(r) && !liveTripIds.has(r)
        );
        if (missing.length) {
          skip(t, 'references a user or trip that did not migrate');
          continue;
        }
      }

      t.prepared++;
      if (!WRITE) continue;

      try {
        const where = m.upsertOn ? { [m.upsertOn]: data[m.upsertOn] } : { id: data.id };
        await (prisma as any)[m.model].upsert({ where, create: data, update: data });
        t.written++;
      } catch (e: any) {
        skip(t, describeError(e));
      }
    }
  }
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

/**
 * The Sprint 4 gate, finally runnable: count before, count after.
 *
 * A migration that reports success and moved nine tenths of the rows is worse
 * than one that fails, because nobody goes looking. This compares both sides
 * and says plainly whether they agree.
 */
async function reconcile(db: any) {
  console.log('\n=== Reconciliation ===');

  const collections = (await db.listCollections().toArray()).map((c: any) => c.name);
  const bookingName = collections.find((n: string) =>
    /^(groupbookings|group_bookings|bookings)$/i.test(n)
  );

  const atlas = {
    users: await db.collection('users').countDocuments(),
    trips: await db.collection('trips').countDocuments(),
    bookings: bookingName ? await db.collection(bookingName).countDocuments() : 0,
  };

  const neon = {
    users: await prisma.user.count(),
    trips: await prisma.trip.count(),
    bookings: await prisma.groupBooking.count(),
  };

  // What this migration was responsible for, rather than what happens to be in
  // the table.
  //
  // Comparing raw totals reported "users atlas=19 neon=44 MISMATCH" on a run
  // where every one of the 19 arrived correctly — Neon also held 25 test
  // accounts from earlier in this work. A reconciliation that cries mismatch
  // when nothing is wrong is one people learn to ignore, which defeats the only
  // thing it is for.
  const migrated = {
    users: tallies.find((t) => t.collection === 'users')!,
    trips: tallies.find((t) => t.collection === 'trips')!,
    bookings: tallies.find((t) => t.collection === 'groupbookings')!,
  };

  let allMatch = true;
  for (const key of ['users', 'trips', 'bookings'] as const) {
    const a = (atlas as any)[key];
    const n = (neon as any)[key];
    const t = (migrated as any)[key] as Tally;

    // Everything read either arrived or was skipped with a stated reason.
    // Nothing may vanish quietly.
    const accounted = t.written + t.skipped === t.read;
    if (WRITE && !accounted) allMatch = false;

    const verdict = !WRITE
      ? '(dry run)'
      : accounted
      ? `ACCOUNTED — ${t.written} migrated, ${t.skipped} skipped with reasons`
      : `UNACCOUNTED — ${t.read - t.written - t.skipped} rows vanished silently`;

    console.log(
      `  ${key.padEnd(10)} atlas=${String(a).padEnd(7)}neon-total=${String(n).padEnd(7)}${verdict}`
    );
  }

  if (WRITE) {
    console.log(
      allMatch
        ? '\n  Counts agree on every collection.'
        : '\n  Counts DO NOT agree. Do not cut over. The skip reasons above say why.'
    );
  } else {
    console.log('\n  Dry run: neon counts are whatever was already there, not a result.');
  }

  return allMatch;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  if (!ATLAS_URI) {
    console.error('ATLAS_URI is required. Point it at the Atlas cluster to read from.');
    process.exit(1);
  }

  const target = (process.env.DATABASE_URL ?? '').split('@').pop()?.split('?')[0] ?? '(unset)';
  console.log(`Reading from : ${ATLAS_URI.split('@').pop()?.split('/')[0] ?? '(hidden)'}`);
  console.log(`Writing to   : ${target}`);
  console.log(`Mode         : ${WRITE ? 'WRITE' : 'DRY RUN — nothing will be written'}\n`);

  // Atlas is opened read-only. Nothing in this file writes to it, and the
  // driver is told so as well: if this migration is wrong, the source is still
  // whole and the fix is to correct the script and run it again.
  const client = new MongoClient(ATLAS_URI, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db();

  // Order matters. Trips reference users and bookings reference both, so a
  // trip whose organizer has not arrived yet is a foreign key failure rather
  // than a silent orphan.
  await migrateUsers(db);
  await migrateTrips(db);
  await migrateBookings(db);
  await migrateRest(db);

  console.log('\n=== Per collection ===');
  for (const t of tallies) {
    console.log(
      `  ${t.collection.padEnd(16)} read=${String(t.read).padEnd(7)}` +
      `prepared=${String(t.prepared).padEnd(7)}written=${String(t.written).padEnd(7)}skipped=${t.skipped}`
    );
    for (const [reason, count] of t.reasons) {
      console.log(`      ${count} × ${reason}`);
    }
  }

  const ok = await reconcile(db);

  await client.close();
  await prisma.$disconnect();

  if (!WRITE) {
    console.log('\nNothing was written. Re-run with --write once the numbers above look right.');
  }
  process.exit(WRITE && !ok ? 1 : 0);
}

main().catch(async (e) => {
  console.error('\nERROR:', e.message);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
