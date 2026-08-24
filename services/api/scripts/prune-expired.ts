/**
 * Delete rows that MongoDB used to expire on its own.
 *
 *   npx ts-node scripts/prune-expired.ts                    # dry run, reports only
 *   npx ts-node scripts/prune-expired.ts --commit           # actually deletes
 *   npx ts-node scripts/prune-expired.ts --commit --days 180
 *
 * THIS SCRIPT REPLACES A DATABASE FEATURE, AND NOTHING RUNS IT AUTOMATICALLY.
 *
 * Two Mongoose schemas carried TTL indexes, and MongoDB ran a background thread
 * that deleted expired documents without anyone asking:
 *
 *   audit_logs      index({ timestamp: 1 }, { expireAfterSeconds: 90 days })
 *   ai_conversations index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
 *
 * Postgres has no TTL. If this is never scheduled, both tables grow forever -
 * audit_logs is written on every login, payment and admin action, and
 * ai_conversations on every assistant session. That is a slow leak, not a
 * crash, so nothing complains until the disk does.
 *
 * Schedule it: cron, a systemd timer, pg_cron, or the platform's scheduler.
 * Daily is plenty.
 *
 * Supersedes prune-audit-logs.ts, which covered only the first table.
 *
 * The two tables expire on different rules, and that difference is deliberate:
 *   - audit_logs has no expiry column, so age is measured from `timestamp`
 *     against a retention window given here.
 *   - ai_conversations carries its own `expiresAt`, written 30 days ahead by
 *     the code that creates it. That column is the authority; --days does not
 *     apply, because overriding a per-row expiry from the command line would
 *     delete conversations their own records say are still live.
 */
import { prisma } from '../src/lib/prisma';

const COMMIT = process.argv.includes('--commit');
const daysFlag = process.argv.indexOf('--days');
const DAYS = daysFlag !== -1 ? parseInt(process.argv[daysFlag + 1], 10) : 90;
const BATCH = 5000;

/** Delete in batches so a large first run does not hold one long transaction. */
async function deleteInBatches(
  label: string,
  findIds: (take: number) => Promise<{ id: string }[]>,
  deleteByIds: (ids: string[]) => Promise<{ count: number }>
) {
  let deleted = 0;
  for (;;) {
    const batch = await findIds(BATCH);
    if (batch.length === 0) break;
    const result = await deleteByIds(batch.map(r => r.id));
    deleted += result.count;
    console.log('  ' + label + ': deleted ' + deleted);
  }
  return deleted;
}

async function main() {
  if (!Number.isInteger(DAYS) || DAYS < 1) {
    throw new Error('--days must be a positive integer');
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - DAYS);
  const now = new Date();

  const auditExpired = await prisma.auditLog.count({ where: { timestamp: { lt: cutoff } } });
  const convExpired = await prisma.aIConversation.count({
    where: { expiresAt: { not: null, lt: now } }
  });

  console.log('audit_logs retention:  ' + DAYS + ' days (cutoff ' + cutoff.toISOString() + ')');
  console.log('  total:               ' + (await prisma.auditLog.count()));
  console.log('  expired:             ' + auditExpired);
  console.log('ai_conversations:      expiresAt in the past');
  console.log('  total:               ' + (await prisma.aIConversation.count()));
  console.log('  expired:             ' + convExpired);
  console.log(COMMIT ? 'mode: COMMIT' : 'mode: DRY RUN (pass --commit to delete)');

  if (!COMMIT) {
    if (auditExpired + convExpired > 0) {
      console.log('');
      console.log('nothing deleted. re-run with --commit to remove those '
        + (auditExpired + convExpired) + ' rows.');
    }
    await prisma.$disconnect();
    return;
  }

  console.log('');

  const auditDeleted = await deleteInBatches(
    'audit_logs',
    take => prisma.auditLog.findMany({
      where: { timestamp: { lt: cutoff } }, select: { id: true }, take
    }),
    ids => prisma.auditLog.deleteMany({ where: { id: { in: ids } } })
  );

  // Messages go with their conversation by cascade, so they are not swept
  // separately - and cannot be left behind pointing at nothing.
  const convDeleted = await deleteInBatches(
    'ai_conversations',
    take => prisma.aIConversation.findMany({
      where: { expiresAt: { not: null, lt: now } }, select: { id: true }, take
    }),
    ids => prisma.aIConversation.deleteMany({ where: { id: { in: ids } } })
  );

  console.log('');
  console.log('audit_logs deleted:       ' + auditDeleted);
  console.log('ai_conversations deleted: ' + convDeleted);
  console.log('audit_logs remaining:       ' + (await prisma.auditLog.count()));
  console.log('ai_conversations remaining: ' + (await prisma.aIConversation.count()));

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
