/**
 * Delete audit log rows older than the retention window.
 *
 *   npx ts-node scripts/prune-audit-logs.ts              # dry run, reports only
 *   npx ts-node scripts/prune-audit-logs.ts --commit     # actually deletes
 *   npx ts-node scripts/prune-audit-logs.ts --commit --days 180
 *
 * THIS SCRIPT REPLACES A DATABASE FEATURE, AND NOTHING RUNS IT AUTOMATICALLY.
 *
 * The Mongoose model carried a TTL index:
 *
 *   auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 90*24*60*60 })
 *
 * MongoDB ran a background thread that deleted expired documents on its own.
 * Postgres has no equivalent. If this script is never scheduled, audit_logs
 * grows forever - the table that gets written on every login, payment and
 * admin action. That is a slow leak, not a crash, so nothing will complain
 * until the disk does.
 *
 * Schedule it: cron, a systemd timer, pg_cron, or the platform's scheduler.
 * Daily is plenty.
 *
 * Deletes in batches so a large first run does not hold one long transaction
 * or lock the table against the writes still arriving.
 */
import { prisma } from '../src/lib/prisma';

const COMMIT = process.argv.includes('--commit');
const daysFlag = process.argv.indexOf('--days');
const DAYS = daysFlag !== -1 ? parseInt(process.argv[daysFlag + 1], 10) : 90;
const BATCH = 5000;

async function main() {
  if (!Number.isInteger(DAYS) || DAYS < 1) {
    throw new Error('--days must be a positive integer');
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS);

  const total = await prisma.auditLog.count();
  const expired = await prisma.auditLog.count({ where: { timestamp: { lt: cutoff } } });

  console.log('retention:        ' + DAYS + ' days');
  console.log('cutoff:           ' + cutoff.toISOString());
  console.log('rows total:       ' + total);
  console.log('rows expired:     ' + expired);
  console.log(COMMIT ? 'mode: COMMIT' : 'mode: DRY RUN (pass --commit to delete)');

  if (!COMMIT || expired === 0) {
    if (!COMMIT && expired > 0) {
      console.log('');
      console.log('nothing deleted. re-run with --commit to remove those ' + expired + ' rows.');
    }
    await prisma.$disconnect();
    return;
  }

  let deleted = 0;
  for (;;) {
    // Select a batch of ids, then delete those - deleteMany with a limit is not
    // available, and an unbounded delete on a large table blocks writers.
    const batch = await prisma.auditLog.findMany({
      where: { timestamp: { lt: cutoff } },
      select: { id: true },
      take: BATCH
    });
    if (batch.length === 0) break;

    const result = await prisma.auditLog.deleteMany({
      where: { id: { in: batch.map(r => r.id) } }
    });
    deleted += result.count;
    console.log('  deleted ' + deleted + ' / ' + expired);
  }

  console.log('');
  console.log('deleted:          ' + deleted);
  console.log('rows remaining:   ' + (await prisma.auditLog.count()));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
