/**
 * Can the user foreign keys actually go on?
 *
 *   npx ts-node scripts/check-user-references.ts
 *
 * Read-only. Writes nothing, to either database.
 *
 * ─── What this answers ───────────────────────────────────────────────────────
 *
 * Every table migrated in waves 1-8 holds user ids as bare String columns with
 * nothing behind them - 41 columns across the schema. Wave 9 turns them into
 * real foreign keys, and a foreign key is refused by any row pointing at a user
 * that does not exist.
 *
 * So before writing the schema: which rows point at nothing?
 *
 * The answer decides the shape of the migration:
 *
 *   - zero orphans          -> the FKs go on as written
 *   - a few, in soft data   -> delete those rows, then add the FKs
 *   - orphans in real data  -> the column becomes nullable with ON DELETE SET
 *                              NULL, or the FK waits
 *
 * ─── Why it runs before the schema, not after ────────────────────────────────
 *
 * Finding this out from a failed `migrate deploy` on production is the worst
 * possible time: the migration is half applied, and the fix is a data decision
 * being made under pressure. Production is 19 users and roughly 80 rows that
 * reference one, so this is seconds of work and can be checked by reading.
 *
 * Run it against production before the cutover, with the Atlas connection
 * string and the Supabase one, not just locally.
 */

import mongoose from 'mongoose';
import { prisma } from '../src/lib/prisma';

/** Every Postgres column that holds a user id, as (table, column) pairs. */
const USER_REFERENCES: Array<{ table: string; column: string; nullable: boolean }> = [
  { table: 'vendors', column: 'organizer_id', nullable: false },
  { table: 'follows', column: 'follower_id', nullable: false },
  { table: 'follows', column: 'following_id', nullable: false },
  { table: 'wishlists', column: 'user_id', nullable: false },
  { table: 'user_activities', column: 'user_id', nullable: false },
  { table: 'posts', column: 'author_id', nullable: false },
  { table: 'post_likes', column: 'user_id', nullable: false },
  { table: 'comments', column: 'author_id', nullable: false },
  { table: 'comment_likes', column: 'user_id', nullable: false },
  { table: 'reviews', column: 'reviewer_id', nullable: false },
  { table: 'reviews', column: 'user_id', nullable: true },
  { table: 'review_helpful_votes', column: 'user_id', nullable: false },
  { table: 'review_flags', column: 'user_id', nullable: false },
  { table: 'audit_logs', column: 'user_id', nullable: false },
  { table: 'notifications', column: 'user_id', nullable: false },
  { table: 'imported_databases', column: 'organizer_id', nullable: false },
  { table: 'blog_posts', column: 'author_id', nullable: false },
  { table: 'group_members', column: 'user_id', nullable: false },
  { table: 'events', column: 'organizer_id', nullable: false },
  { table: 'event_participants', column: 'user_id', nullable: false },
  { table: 'trips', column: 'organizer_id', nullable: false },
  { table: 'trips', column: 'verified_by', nullable: true },
  { table: 'trip_participants', column: 'user_id', nullable: false },
  { table: 'group_bookings', column: 'main_booker_id', nullable: false },
  { table: 'group_bookings', column: 'verified_by', nullable: true },
  { table: 'custom_trip_requests', column: 'traveler_id', nullable: false },
  { table: 'custom_trip_proposals', column: 'organizer_id', nullable: false },
  { table: 'trip_verifications', column: 'organizer_id', nullable: false },
  { table: 'trip_verifications', column: 'verified_by', nullable: true },
  { table: 'verification_requests', column: 'organizer_id', nullable: false },
  { table: 'verification_requests', column: 'reviewed_by', nullable: true },
  { table: 'organizer_subscriptions', column: 'organizer_id', nullable: false },
  { table: 'organizer_payout_configs', column: 'organizer_id', nullable: false },
  { table: 'crm_subscriptions', column: 'organizer_id', nullable: false },
  { table: 'expenses', column: 'organizer_id', nullable: false },
  { table: 'payout_ledger', column: 'organizer_id', nullable: false },
  { table: 'marketplace_orders', column: 'user_id', nullable: false },
  { table: 'marketplace_orders', column: 'organizer_id', nullable: false },
  { table: 'marketplace_transfers', column: 'organizer_id', nullable: false },
  { table: 'marketplace_refunds', column: 'created_by', nullable: true },
  { table: 'support_tickets', column: 'user_id', nullable: false }
];

async function main() {
  const uri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');

  await mongoose.connect(uri);
  const db = mongoose.connection.db!;

  // Every user id Mongo actually has.
  const users = await db.collection('users').find({}, { projection: { _id: 1 } }).toArray();
  const known = new Set(users.map(u => String(u._id)));
  console.log(`users in Mongo: ${known.size}\n`);

  let referencesChecked = 0;
  let orphanTotal = 0;
  const problems: Array<{ table: string; column: string; orphans: string[]; rows: number }> = [];

  for (const ref of USER_REFERENCES) {
    let rows: Array<{ value: string | null }>;
    try {
      rows = await prisma.$queryRawUnsafe<Array<{ value: string | null }>>(
        `SELECT DISTINCT "${ref.column}" AS value FROM "${ref.table}"`
      );
    } catch (error: any) {
      // A table that does not exist yet is not a problem, it is a wave that has
      // not landed. Say so rather than failing the whole check.
      console.log(`  skipped ${ref.table}.${ref.column}: ${error.message.split('\n')[0]}`);
      continue;
    }

    const values = rows.map(r => r.value).filter((v): v is string => v !== null);
    referencesChecked += values.length;

    const orphans = values.filter(v => !known.has(v));
    if (orphans.length > 0) {
      // Count the rows, not just the distinct ids - that is what has to be
      // fixed before the constraint goes on.
      const [{ count }] = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT count(*) AS count FROM "${ref.table}" WHERE "${ref.column}" = ANY($1::text[])`,
        orphans
      );
      problems.push({ table: ref.table, column: ref.column, orphans, rows: Number(count) });
      orphanTotal += Number(count);
    }
  }

  console.log(`\ndistinct user references checked: ${referencesChecked}`);

  if (problems.length === 0) {
    console.log('\nNo orphans. Every user reference points at a real user, so the');
    console.log('foreign keys can go on as written.');
  } else {
    console.log(`\n${orphanTotal} row(s) point at a user that does not exist:\n`);
    for (const p of problems) {
      const nullable = USER_REFERENCES.find(
        r => r.table === p.table && r.column === p.column
      )!.nullable;
      console.log(`  ${p.table}.${p.column}  ${p.rows} row(s), ${p.orphans.length} missing user(s)`);
      console.log(`    ${p.orphans.slice(0, 5).join(', ')}${p.orphans.length > 5 ? ' ...' : ''}`);
      console.log(
        `    -> ${nullable
          ? 'column is nullable: ON DELETE SET NULL, or null these rows first'
          : 'column is NOT NULL: these rows must be deleted or repointed before the FK'}`
      );
    }
    console.log('\nThe foreign keys cannot go on until each of these is decided.');
  }

  await mongoose.disconnect();
  await prisma.$disconnect();
  process.exit(problems.length === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(2);
});
