/**
 * Backfill Mongo reviews into Postgres. D10/D11 wave 2.
 *
 *   npx ts-node scripts/backfill-reviews.ts            # dry run
 *   npx ts-node scripts/backfill-reviews.ts --commit   # actually writes
 *
 * Safe to run more than once: skipDuplicates keys on the unique constraint.
 *
 * This backfill has more to report than the others, because Mongoose enforced
 * several of these rules only through the model. Anything written another way
 * could have broken them, and Postgres will not accept those rows:
 *
 *   - a duplicate (reviewerId, targetId, reviewType). The old rule was a
 *     pre-save hook, so two concurrent writes could both land. Duplicates are
 *     counted and the *earliest* is kept, because that is the one users saw.
 *   - a rating outside 1..5
 *   - a tag outside the closed list. The Mongoose enum stored anything that
 *     bypassed the model, and such a tag then matched no filter. It is dropped
 *     from the row and counted, rather than failing the whole review.
 *   - title over 100 or comment over 1000 characters.
 *
 * Mongo _id values are carried across as the primary key so existing links keep
 * resolving; rows created from here on get UUIDs.
 *
 * helpfulVoters and flags were arrays on the document and become rows. The
 * stored `helpfulVotes` number is deliberately NOT carried over: it is derived
 * from the vote rows now, and if the two ever disagreed the array is the record
 * of who actually voted.
 */
import mongoose from 'mongoose';
import { prisma } from '../src/lib/prisma';
import { Review } from '../src/models/Review';

const COMMIT = process.argv.includes('--commit');
const BATCH = 500;

const TAGS = new Set([
  'safety', 'value_for_money', 'organization', 'communication',
  'accommodation', 'food', 'activities', 'guide_quality',
  'group_size', 'timing', 'location', 'equipment'
]);

const toTag = (s: any): string | null => {
  const t = String(s).toLowerCase().trim().replace(/-/g, '_');
  return TAGS.has(t) ? t : null;
};

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) throw new Error('MONGODB_URI is not set');
  await mongoose.connect(mongoUri);

  const total = await Review.countDocuments({});
  console.log('mongo reviews:    ' + total);
  console.log('postgres before:  ' + (await prisma.review.count()));
  console.log(COMMIT ? 'mode: COMMIT' : 'mode: DRY RUN (pass --commit to write)');

  const skipped = { missingId: 0, badRating: 0, longTitle: 0, longComment: 0, badType: 0, duplicate: 0 };
  let scanned = 0, written = 0, votes = 0, flags = 0, droppedTags = 0;

  // (reviewerId|targetId|reviewType) already seen in this run
  const seen = new Set<string>();

  for (let skip = 0; skip < total; skip += BATCH) {
    // Oldest first, so the review kept for a duplicated triple is the first one written.
    const docs = await Review.find({}).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(BATCH).lean();

    const rows: any[] = [];
    const voteRows: any[] = [];
    const flagRows: any[] = [];

    for (const d of docs as any[]) {
      scanned++;

      const id = d._id?.toString();
      const reviewerId = d.reviewerId?.toString();
      const targetId = d.targetId?.toString();
      if (!id || !reviewerId || !targetId) { skipped.missingId++; continue; }

      if (d.reviewType !== 'trip' && d.reviewType !== 'organizer') { skipped.badType++; continue; }

      const key = reviewerId + '|' + targetId + '|' + d.reviewType;
      if (seen.has(key)) { skipped.duplicate++; continue; }
      seen.add(key);

      const rating = Number(d.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 5) { skipped.badRating++; continue; }

      if (typeof d.title === 'string' && d.title.length > 100) { skipped.longTitle++; continue; }
      if (typeof d.comment === 'string' && d.comment.length > 1000) { skipped.longComment++; continue; }

      const rawTags: any[] = Array.isArray(d.tags) ? d.tags : [];
      const mapped = rawTags.map(toTag);
      droppedTags += mapped.filter(t => t === null).length;

      rows.push({
        id,
        reviewerId,
        targetId,
        reviewType: d.reviewType,
        rating,
        title: d.title,
        comment: d.comment,
        images: Array.isArray(d.images) ? d.images.filter(Boolean).map(String) : [],
        tags: Array.from(new Set(mapped.filter(Boolean))) as any[],
        isVerified: !!d.isVerified,
        organizerResponseMessage: d.organizerResponse?.message ?? null,
        organizerResponseRespondedAt: d.organizerResponse?.respondedAt ?? null,
        tripDate: d.tripDate ?? null,
        userId: d.userId ? d.userId.toString() : null,
        tripId: d.tripId ? d.tripId.toString() : null,
        verifiedAt: d.verifiedAt ?? null,
        verifiedBy: d.verifiedBy ? d.verifiedBy.toString() : null,
        verificationNotes: d.verificationNotes ?? null,
        isRejected: !!d.isRejected,
        rejectedAt: d.rejectedAt ?? null,
        rejectedBy: d.rejectedBy ? d.rejectedBy.toString() : null,
        rejectionReason: d.rejectionReason ?? null,
        isFlagged: !!d.isFlagged,
        flaggedAt: d.flaggedAt ?? null,
        moderatedAt: d.moderatedAt ?? null,
        moderatedBy: d.moderatedBy ? d.moderatedBy.toString() : null,
        moderationNotes: d.moderationNotes ?? null,
        createdAt: d.createdAt ?? new Date(),
        updatedAt: d.updatedAt ?? d.createdAt ?? new Date()
      });

      for (const raw of new Set((Array.isArray(d.helpfulVoters) ? d.helpfulVoters : [])
        .map((u: any) => u?.toString()).filter(Boolean))) {
        voteRows.push({ reviewId: id, userId: raw });
      }

      const flagSeen = new Set<string>();
      for (const f of (Array.isArray(d.flags) ? d.flags : [])) {
        const uid = f?.userId?.toString();
        if (!uid || flagSeen.has(uid)) continue;
        flagSeen.add(uid);
        flagRows.push({ reviewId: id, userId: uid, reason: f.reason ?? 'unspecified', flaggedAt: f.flaggedAt ?? new Date() });
      }
    }

    if (COMMIT && rows.length) {
      written += (await prisma.review.createMany({ data: rows, skipDuplicates: true })).count;
      if (voteRows.length) {
        votes += (await prisma.reviewHelpfulVote.createMany({ data: voteRows, skipDuplicates: true })).count;
      }
      if (flagRows.length) {
        flags += (await prisma.reviewFlag.createMany({ data: flagRows, skipDuplicates: true })).count;
      }
    }
  }

  console.log('');
  console.log('scanned:          ' + scanned);
  console.log('written:          ' + written);
  console.log('helpful votes:    ' + votes);
  console.log('flags:            ' + flags);
  console.log('tags dropped:     ' + droppedTags + '  (outside the closed list; the review still landed)');
  console.log('skipped:');
  console.log('  duplicate:      ' + skipped.duplicate + '  (earliest kept - the pre-save hook could not stop these)');
  console.log('  missing id:     ' + skipped.missingId);
  console.log('  rating not 1-5: ' + skipped.badRating);
  console.log('  bad reviewType: ' + skipped.badType);
  console.log('  title > 100:    ' + skipped.longTitle);
  console.log('  comment > 1000: ' + skipped.longComment);
  console.log('postgres after:   ' + (await prisma.review.count()));

  await mongoose.disconnect();
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
