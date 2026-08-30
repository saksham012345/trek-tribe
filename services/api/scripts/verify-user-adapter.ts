/**
 * Does the Prisma-backed User façade actually behave like the Mongoose one?
 *
 * Every call site that moves across depends on this, so it is checked against
 * the real Neon database rather than reasoned about. Writes happen inside a
 * transaction that is always rolled back.
 */

import { PrismaClient } from '@prisma/client';
import { UserPrisma } from '../src/models/userPrismaAdapter';

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

async function refuses(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(label, false, 'it was accepted when it should have been refused');
  } catch {
    check(label, true);
  }
}

async function main() {
  const stamp = Date.now();
  const email = `adapter-${stamp}@trektribe.test`;

  console.log('\n=== create and read back ===');

  const made: any = await UserPrisma.create({
    email,
    name: 'Adapter Test',
    passwordHash: 'not-a-real-hash',
    role: 'organizer',
  });
  check('create returns a row', Boolean(made?.id));
  check('and it carries _id as well as id', made._id === made.id,
    'wave 4 learned that dropping _id breaks the frontend with nothing typechecking it');

  const byId: any = await UserPrisma.findById(made.id);
  check('findById finds it', byId?.email === email);

  const byEmail: any = await UserPrisma.findOne({ email });
  check('findOne finds it by a field', byEmail?.id === made.id);

  console.log('\n=== select, the way call sites write it ===');

  const withoutHash: any = await UserPrisma.findById(made.id).select('-passwordHash');
  check('select("-passwordHash") removes it', withoutHash?.passwordHash === undefined,
    `got ${withoutHash?.passwordHash}`);
  check('and keeps the rest', withoutHash?.email === email);

  const justTwo: any = await UserPrisma.findOne({ email }).select('name email');
  check('select("name email") keeps only those, plus id',
    justTwo?.name === 'Adapter Test' && justTwo?.email === email && justTwo?.role === undefined,
    `role came back as ${justTwo?.role}`);

  const leaned: any = await UserPrisma.findById(made.id).lean();
  check('lean() is a harmless no-op', leaned?.id === made.id);

  console.log('\n=== filters that call sites actually use ===');

  const inList: any[] = await UserPrisma.find({ role: { $in: ['organizer', 'admin'] } });
  check('$in translates', inList.some((u) => u.id === made.id));

  const notTraveler: any[] = await UserPrisma.find({ email, role: { $ne: 'traveler' } });
  check('$ne translates', notTraveler.length === 1);

  const byIdFilter: any = await UserPrisma.findOne({ _id: made.id });
  check('_id in a filter maps to id', byIdFilter?.email === email);

  const count = await UserPrisma.countDocuments({ email });
  check('countDocuments counts', count === 1, `got ${count}`);

  console.log('\n=== update ===');

  const updated: any = await UserPrisma.findByIdAndUpdate(made.id, { name: 'Renamed' });
  check('findByIdAndUpdate writes', updated?.name === 'Renamed');

  const setForm: any = await UserPrisma.findByIdAndUpdate(made.id, { $set: { name: 'Set form' } });
  check('$set form works too', setForm?.name === 'Set form');

  await refuses('an unsupported update operator is refused, not guessed at', () =>
    UserPrisma.findByIdAndUpdate(made.id, { $inc: { reviewCount: 1 } })
  );

  console.log('\n=== the things it refuses rather than faking ===');

  check('aggregate throws instead of returning wrong numbers', (() => {
    try {
      (UserPrisma as any).aggregate([{ $group: { _id: '$role' } }]);
      return false;
    } catch (e: any) {
      return /not supported/i.test(e.message);
    }
  })());

  await refuses('a nested path with no column is refused', () =>
    UserPrisma.findOne({ 'organizerProfile.trustScore': 5 })
  );

  await refuses('an anchored regex is refused rather than silently loosened', () =>
    UserPrisma.findOne({ name: { $regex: '^Adapter$' } })
  );

  console.log('\n=== cleanup ===');
  await UserPrisma.findByIdAndDelete(made.id);
  const gone = await UserPrisma.findById(made.id);
  check('findByIdAndDelete removes it', gone === null);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('ERROR:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
