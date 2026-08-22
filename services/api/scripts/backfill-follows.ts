/**
 * Backfill Mongo `follows` documents into the Postgres `follows` table.
 * D10/D11 wave 1.
 *
 *   npx ts-node scripts/backfill-follows.ts            # dry run, reports only
 *   npx ts-node scripts/backfill-follows.ts --commit   # actually writes
 *
 * Safe to run more than once. `skipDuplicates` means an interrupted run can be
 * restarted without producing duplicates, and a second run is a no-op.
 *
 * Self-follows are reported and skipped rather than written, because the table
 * has a CHECK that rejects them. Mongo never enforced that, so old data may
 * contain some; failing the whole batch over them would be worse than saying so.
 */
import mongoose from 'mongoose';
import { prisma } from '../src/lib/prisma';
import { Follow } from '../src/models/Follow';

const COMMIT = process.argv.includes('--commit');
const BATCH = 1000;

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(mongoUri);

  const total = await Follow.countDocuments({});
  console.log(`mongo follows:    ${total}`);
  console.log(`postgres before:  ${await prisma.follow.count()}`);
  console.log(COMMIT ? 'mode: COMMIT' : 'mode: DRY RUN (pass --commit to write)');

  let scanned = 0, written = 0, selfFollows = 0, malformed = 0;

  for (let skip = 0; skip < total; skip += BATCH) {
    const docs = await Follow.find({}).sort({ _id: 1 }).skip(skip).limit(BATCH).lean();

    const rows: { followerId: string; followingId: string; createdAt: Date; updatedAt: Date }[] = [];
    for (const d of docs as any[]) {
      scanned++;
      const followerId = d.followerId?.toString();
      const followingId = d.followingId?.toString();

      if (!followerId || !followingId) { malformed++; continue; }
      if (followerId === followingId) { selfFollows++; continue; }

      rows.push({
        followerId,
        followingId,
        createdAt: d.createdAt ?? new Date(),
        updatedAt: d.updatedAt ?? d.createdAt ?? new Date()
      });
    }

    if (COMMIT && rows.length) {
      const result = await prisma.follow.createMany({ data: rows, skipDuplicates: true });
      written += result.count;
    }
  }

  console.log('');
  console.log(`scanned:          ${scanned}`);
  console.log(`self-follows:     ${selfFollows}  (skipped - the CHECK rejects them)`);
  console.log(`malformed:        ${malformed}  (skipped - missing an id)`);
  console.log(`written:          ${written}`);
  console.log(`postgres after:   ${await prisma.follow.count()}`);

  const expected = scanned - selfFollows - malformed;
  const actual = await prisma.follow.count();
  if (COMMIT && actual < expected) {
    console.log('');
    console.log(`MISMATCH: expected at least ${expected} rows, found ${actual}`);
    process.exitCode = 1;
  }

  await mongoose.disconnect();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
