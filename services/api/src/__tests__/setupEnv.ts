// Setup environment variables BEFORE test modules are imported
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-that-is-long-enough-12345';
process.env.RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || 'test_razorpay_key';
process.env.RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'test_razorpay_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || 'test_webhook_secret';

// Disable auto-start of server when importing index.ts
process.env.DISABLE_AUTO_START = 'true';

/**
 * Refuse to run the suite against a database that is not disposable.
 *
 * NODE_ENV=test above does not change DATABASE_URL, so until this existed the
 * tests wrote to whatever .env pointed at. That is not hypothetical: this suite
 * was run against the Neon database holding production data, and 01-auth's
 * `User.deleteMany({})` emptied the users table mid-run. It was caught only
 * because a Playwright run failed at the same moment and the 404s were traced
 * back.
 *
 * One guard here protects every test file, which is better than auditing the
 * cleanup in each of them and hoping whoever adds the next one remembers.
 *
 * A local, in-memory or explicitly-named test database is allowed. Anything
 * else has to be opted into by hand, and the message says what the risk is
 * rather than only refusing.
 */
// .env has to be read here, not assumed.
//
// setupFiles runs before dotenv, so DATABASE_URL was empty when this check
// first ran — and an empty value was treated as safe. It is not: Prisma loads
// .env itself a moment later and connects to whatever it finds. The first
// version of this guard passed happily while the suite went on writing to the
// production database, which is a worse failure than having no guard, because
// it looks like protection.
require('dotenv').config();

const dbUrl = process.env.DATABASE_URL ?? '';
const looksDisposable =
  /localhost|127\.0\.0\.1|host\.docker\.internal/i.test(dbUrl) ||
  /_test|test_|-test(\b|_)|\/test$/i.test(dbUrl);

if (!looksDisposable && process.env.ALLOW_TESTS_ON_THIS_DB !== 'yes') {
  const where = dbUrl.split('@').pop()?.split('?')[0] ?? '(unparseable)';
  throw new Error(
    `\n\nRefusing to run tests against ${where}.\n\n` +
    `This suite deletes rows. Several files call deleteMany, and one of them\n` +
    `used to do it with no filter at all — that emptied a live users table once\n` +
    `already.\n\n` +
    `Point DATABASE_URL at a local or _test database, or set\n` +
    `ALLOW_TESTS_ON_THIS_DB=yes if this really is a throwaway copy.\n`
  );
}

// Any other environment defaults required for tests can be added here
