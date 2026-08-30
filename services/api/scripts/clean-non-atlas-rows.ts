/**
 * Remove everything in Neon that did not come from Atlas.
 *
 * Neon holds real production data now, and alongside it the wreckage of getting
 * there: accounts from the end-to-end suite, from Playwright, and — the largest
 * part — from the jest suite, which was run against this database before anyone
 * noticed it was no longer pointed at a throwaway Mongo.
 *
 * Identifying those by email pattern is not safe enough. The list contains
 * testuser@example.com from a unit test, qa.traveler.doc20260511@trektribe.in
 * from real production QA, and trektribe-travreg-org-...@wshu.net which reads
 * like junk and came from Atlas. Guessing wrong here deletes a customer.
 *
 * So the test is not what an address looks like. Every row that came from Atlas
 * has an id derived from its Mongo _id — that is how the migration made foreign
 * keys line up — so the same derivation, run again over Atlas, produces exactly
 * the set of ids that belong here. Anything else was created locally.
 *
 * Dry run unless --write.
 */

import { MongoClient, ObjectId } from 'mongodb';
import { scriptPrisma } from './_scriptPrisma';
import crypto from 'crypto';
import dns from 'dns';

if (process.env.MIGRATION_DNS) {
  dns.setServers(process.env.MIGRATION_DNS.split(',').map((s) => s.trim()));
}

const WRITE = process.argv.includes('--write');
const ATLAS_URI = process.env.ATLAS_URI ?? '';
const prisma = scriptPrisma();

/** Identical to the migration's derivation — it has to be, or this deletes real rows. */
const NAMESPACE = 'trektribe-atlas-to-neon-v1';
function toUuid(id: ObjectId | string): string {
  const key = typeof id === 'string' ? id : id.toHexString();
  const hash = crypto.createHash('sha1').update(NAMESPACE).update(key).digest();
  const b = Buffer.from(hash.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x50;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = b.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function main() {
  if (!ATLAS_URI) {
    console.error('ATLAS_URI is required: the set of rows to KEEP is derived from it.');
    process.exit(1);
  }

  console.log(`Mode: ${WRITE ? 'WRITE' : 'DRY RUN — nothing will be deleted'}\n`);

  const client = new MongoClient(ATLAS_URI, { readPreference: 'secondaryPreferred' });
  await client.connect();
  const db = client.db();

  // The authority for what belongs. Read from Atlas every time rather than
  // cached anywhere: a stale list would delete rows that were migrated later.
  const keepUsers = new Set<string>();
  const keepTrips = new Set<string>();

  for (const d of await db.collection('users').find({}, { projection: { _id: 1 } }).toArray()) {
    keepUsers.add(toUuid(d._id));
  }
  for (const d of await db.collection('trips').find({}, { projection: { _id: 1 } }).toArray()) {
    keepTrips.add(toUuid(d._id));
  }
  await client.close();

  console.log(`Atlas says keep: ${keepUsers.size} users, ${keepTrips.size} trips\n`);

  if (keepUsers.size === 0) {
    console.error('Atlas returned no users. Refusing to continue — that would delete everything.');
    process.exit(1);
  }

  const users = await prisma.user.findMany({ select: { id: true, email: true, name: true } });
  const trips = await prisma.trip.findMany({ select: { id: true, title: true } });

  const dropUsers = users.filter((u) => !keepUsers.has(u.id));
  const dropTrips = trips.filter((t) => !keepTrips.has(t.id));

  console.log(`--- ${dropUsers.length} users not from Atlas ---`);
  dropUsers.forEach((u) => console.log(`  ${u.email.padEnd(48)} ${u.name}`));
  console.log(`\n--- ${dropTrips.length} trips not from Atlas ---`);
  dropTrips.forEach((t) => console.log(`  ${t.title}`));

  console.log(`\n--- ${users.length - dropUsers.length} users kept ---`);

  if (!WRITE) {
    console.log('\nDry run. Re-run with --write to delete the rows listed above.');
    await prisma.$disconnect();
    return;
  }

  // Children first. Deleting a user with rows hanging off it fails on a foreign
  // key, and a half-finished cleanup is worse than none — it leaves a database
  // nobody can reason about.
  const dropUserIds = dropUsers.map((u) => u.id);
  const dropTripIds = dropTrips.map((t) => t.id);

  const removed: Record<string, number> = {};
  const del = async (label: string, fn: () => Promise<{ count: number }>) => {
    try {
      removed[label] = (await fn()).count;
    } catch (e: any) {
      removed[label] = -1;
      console.error(`  ${label}: ${e.message.split('\n').pop()?.slice(0, 90)}`);
    }
  };

  await del('coupon_redemptions', () =>
    prisma.couponRedemption.deleteMany({ where: { coupon: { organizerId: { in: dropUserIds } } } })
  );
  await del('coupons', () => prisma.coupon.deleteMany({ where: { organizerId: { in: dropUserIds } } }));
  await del('discount_floors', () =>
    prisma.discountFloor.deleteMany({ where: { organizerId: { in: dropUserIds } } })
  );
  await del('ai_generation_requests', () =>
    prisma.aiGenerationRequest.deleteMany({ where: { organizerId: { in: dropUserIds } } })
  );
  await del('ai_quotas', () => prisma.aiQuota.deleteMany({ where: { organizerId: { in: dropUserIds } } }));
  await del('group_bookings', () =>
    prisma.groupBooking.deleteMany({
      where: { OR: [{ tripId: { in: dropTripIds } }, { mainBookerId: { in: dropUserIds } }] },
    })
  );
  await del('user_activities', () =>
    prisma.userActivity.deleteMany({ where: { userId: { in: dropUserIds } } })
  );
  await del('notifications', () =>
    prisma.notification.deleteMany({ where: { userId: { in: dropUserIds } } })
  );
  await del('trips', () => prisma.trip.deleteMany({ where: { id: { in: dropTripIds } } }));
  await del('users', () => prisma.user.deleteMany({ where: { id: { in: dropUserIds } } }));

  console.log('\n--- removed ---');
  for (const [k, v] of Object.entries(removed)) {
    console.log(`  ${k.padEnd(24)} ${v === -1 ? 'FAILED (see above)' : v}`);
  }

  const after = await prisma.user.count();
  const afterTrips = await prisma.trip.count();
  console.log(`\nusers now: ${after} (Atlas has ${keepUsers.size})`);
  console.log(`trips now: ${afterTrips} (Atlas has ${keepTrips.size})`);
  console.log(
    after === keepUsers.size && afterTrips === keepTrips.size
      ? '\nNeon now matches Atlas exactly.'
      : '\nStill does not match Atlas. Check the failures above before cutting over.'
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error('ERROR:', e.message);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
