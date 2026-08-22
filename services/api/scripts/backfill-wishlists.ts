/**
 * Backfill Mongo `wishlists` documents into the Postgres `wishlists` table.
 * D10/D11 wave 2.
 *
 *   npx ts-node scripts/backfill-wishlists.ts            # dry run, reports only
 *   npx ts-node scripts/backfill-wishlists.ts --commit   # actually writes
 *
 * Safe to run more than once. `skipDuplicates` means an interrupted run can be
 * restarted without producing duplicates, and a second run is a no-op.
 *
 * Rows that the Postgres constraints would reject are reported and skipped
 * rather than failing the batch, because Mongoose only ever enforced these
 * through the model - anything written another way could have broken them:
 *
 *   - notes longer than 500 characters   (wishlists_notes_max_500)
 *   - a tag longer than 50 characters    (varchar(50))
 *   - a missing userId or tripId         (NOT NULL)
 *   - a priority outside low/medium/high (the enum)
 *
 * Long notes are reported, not truncated. Silently shortening someone's text is
 * worse than telling you it exists and letting you decide.
 */
import mongoose from 'mongoose';
import { prisma } from '../src/lib/prisma';
import { Wishlist } from '../src/models/Wishlist';

const COMMIT = process.argv.includes('--commit');
const BATCH = 1000;
const PRIORITIES = new Set(['low', 'medium', 'high']);

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(mongoUri);

  const total = await Wishlist.countDocuments({});
  console.log('mongo wishlists:  ' + total);
  console.log('postgres before:  ' + (await prisma.wishlist.count()));
  console.log(COMMIT ? 'mode: COMMIT' : 'mode: DRY RUN (pass --commit to write)');

  let scanned = 0, written = 0;
  const skipped = { missingId: 0, longNotes: 0, longTag: 0, badPriority: 0 };

  for (let skip = 0; skip < total; skip += BATCH) {
    const docs = await Wishlist.find({}).sort({ _id: 1 }).skip(skip).limit(BATCH).lean();

    const rows: any[] = [];
    for (const d of docs as any[]) {
      scanned++;

      const userId = d.userId?.toString();
      const tripId = d.tripId?.toString();
      if (!userId || !tripId) { skipped.missingId++; continue; }

      if (d.notes && d.notes.length > 500) { skipped.longNotes++; continue; }

      const tags: string[] = Array.isArray(d.tags) ? d.tags.filter(Boolean).map(String) : [];
      if (tags.some(t => t.length > 50)) { skipped.longTag++; continue; }

      const priority = PRIORITIES.has(d.priority) ? d.priority : null;
      if (!priority) { skipped.badPriority++; continue; }

      rows.push({
        userId,
        tripId,
        notes: d.notes ?? null,
        priority,
        // Match what the route writes, so a backfilled row and a fresh one look the same.
        tags: Array.from(new Set(tags.map(t => t.toLowerCase().trim()).filter(t => t.length > 0))),
        createdAt: d.createdAt ?? new Date(),
        updatedAt: d.updatedAt ?? d.createdAt ?? new Date()
      });
    }

    if (COMMIT && rows.length) {
      const result = await prisma.wishlist.createMany({ data: rows, skipDuplicates: true });
      written += result.count;
    }
  }

  const totalSkipped = skipped.missingId + skipped.longNotes + skipped.longTag + skipped.badPriority;

  console.log('');
  console.log('scanned:          ' + scanned);
  console.log('skipped:          ' + totalSkipped);
  console.log('  missing id:     ' + skipped.missingId);
  console.log('  notes > 500:    ' + skipped.longNotes + '  (reported, never truncated)');
  console.log('  a tag > 50:     ' + skipped.longTag);
  console.log('  bad priority:   ' + skipped.badPriority);
  console.log('written:          ' + written);
  console.log('postgres after:   ' + (await prisma.wishlist.count()));

  const expected = scanned - totalSkipped;
  const actual = await prisma.wishlist.count();
  if (COMMIT && actual < expected) {
    console.log('');
    console.log('MISMATCH: expected at least ' + expected + ' rows, found ' + actual);
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
