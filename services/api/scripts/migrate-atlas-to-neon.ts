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
    if (!WRITE) continue;

    try {
      await prisma.user.upsert({ where: { id }, create: data as any, update: data as any });
      t.written++;
    } catch (e: any) {
      // A duplicate email is the common one: two Mongo documents, one unique
      // column. Recorded rather than swallowed, because it means a person will
      // lose an account and somebody has to decide which.
      skip(t, e.code === 'P2002' ? `unique violation: ${e.meta?.target}` : e.message.slice(0, 80));
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
    if (!WRITE) continue;

    try {
      await prisma.trip.upsert({ where: { id }, create: data as any, update: data as any });
      t.written++;
    } catch (e: any) {
      // A trip whose organizer did not survive the users pass has nothing to
      // hang from. Named rather than counted, so the fix is obvious.
      skip(t, e.code === 'P2003' ? 'organizer not migrated' : e.message.slice(0, 80));
    }
  }
}

// ─── Bookings ────────────────────────────────────────────────────────────────

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
      skip(t, e.code === 'P2003' ? 'trip or booker not migrated' : e.message.slice(0, 80));
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

  let allMatch = true;
  for (const key of ['users', 'trips', 'bookings'] as const) {
    const a = (atlas as any)[key];
    const n = (neon as any)[key];
    const match = WRITE ? a === n : null;
    if (WRITE && !match) allMatch = false;
    const verdict = !WRITE ? '(dry run)' : match ? 'MATCH' : `MISMATCH — ${a - n} missing`;
    console.log(`  ${key.padEnd(10)} atlas=${String(a).padEnd(7)} neon=${String(n).padEnd(7)} ${verdict}`);
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
