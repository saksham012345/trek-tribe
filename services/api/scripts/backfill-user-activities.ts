/**
 * Backfill Mongo `useractivities` documents into the Postgres `user_activities`
 * table. D10/D11 wave 2.
 *
 *   npx ts-node scripts/backfill-user-activities.ts            # dry run
 *   npx ts-node scripts/backfill-user-activities.ts --commit   # actually writes
 *
 * Unlike the follows and wishlists backfills, this table has **no unique
 * constraint** - two identical activities a second apart are both legitimate
 * facts. So `skipDuplicates` cannot protect a re-run, and running this twice
 * would double every row.
 *
 * The guard is `--after <iso-date>`: only documents created strictly after that
 * timestamp are copied. To resume an interrupted run, pass the createdAt of the
 * last row that made it in. The script prints that value when it finishes.
 */
import mongoose from 'mongoose';
import { prisma } from '../src/lib/prisma';
import UserActivity from '../src/models/UserActivity';

const COMMIT = process.argv.includes('--commit');
const afterFlag = process.argv.indexOf('--after');
const AFTER = afterFlag !== -1 ? new Date(process.argv[afterFlag + 1]) : null;
const BATCH = 1000;

const ACTOR_TYPES = new Set(['user', 'organizer']);
const ACTIVITY_TYPES = new Set([
  'trip_view', 'trip_created', 'booking_made', 'chat_initiated', 'ticket_created',
  'payment_made', 'profile_updated', 'document_uploaded', 'login', 'logout'
]);

/** ObjectIds and Dates do not survive a JSON column as themselves. */
function jsonSafe(value: any): any {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(jsonSafe);
  if (typeof value === 'object') {
    if (typeof value.toHexString === 'function') return value.toHexString();
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      const converted = jsonSafe(v);
      if (converted !== null) out[k] = converted;
    }
    return out;
  }
  return value;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(mongoUri);

  const filter: any = AFTER ? { createdAt: { $gt: AFTER } } : {};

  const total = await UserActivity.countDocuments(filter);
  console.log('mongo activities: ' + total + (AFTER ? '  (created after ' + AFTER.toISOString() + ')' : ''));
  console.log('postgres before:  ' + (await prisma.userActivity.count()));
  console.log(COMMIT ? 'mode: COMMIT' : 'mode: DRY RUN (pass --commit to write)');

  if (COMMIT && !AFTER) {
    console.log('');
    console.log('NOTE: no --after given, so this copies every document. There is no');
    console.log('      unique constraint on this table, so running it twice without');
    console.log('      --after will duplicate every row.');
  }

  let scanned = 0, written = 0;
  const skipped = { missingUser: 0, badActorType: 0, badActivityType: 0, noDescription: 0 };
  let lastCreatedAt: Date | null = null;

  for (let skip = 0; skip < total; skip += BATCH) {
    const docs = await UserActivity.find(filter).sort({ createdAt: 1 }).skip(skip).limit(BATCH).lean();

    const rows: any[] = [];
    for (const d of docs as any[]) {
      scanned++;

      const userId = d.userId?.toString();
      if (!userId) { skipped.missingUser++; continue; }
      if (!ACTOR_TYPES.has(d.userType)) { skipped.badActorType++; continue; }
      if (!ACTIVITY_TYPES.has(d.activityType)) { skipped.badActivityType++; continue; }
      if (!d.description) { skipped.noDescription++; continue; }

      rows.push({
        userId,
        userType: d.userType,
        activityType: d.activityType,
        description: d.description,
        metadata: jsonSafe(d.metadata) ?? {},
        createdAt: d.createdAt ?? new Date()
      });
      lastCreatedAt = d.createdAt ?? lastCreatedAt;
    }

    if (COMMIT && rows.length) {
      const result = await prisma.userActivity.createMany({ data: rows });
      written += result.count;
    }
  }

  const totalSkipped = skipped.missingUser + skipped.badActorType + skipped.badActivityType + skipped.noDescription;

  console.log('');
  console.log('scanned:          ' + scanned);
  console.log('skipped:          ' + totalSkipped);
  console.log('  missing userId: ' + skipped.missingUser);
  console.log('  bad userType:   ' + skipped.badActorType);
  console.log('  bad activity:   ' + skipped.badActivityType);
  console.log('  no description: ' + skipped.noDescription);
  console.log('written:          ' + written);
  console.log('postgres after:   ' + (await prisma.userActivity.count()));

  if (COMMIT && lastCreatedAt) {
    console.log('');
    console.log('to resume from here:  --after ' + lastCreatedAt.toISOString());
  }

  await mongoose.disconnect();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
