/**
 * A PrismaClient for one-off scripts.
 *
 * Neon publishes two endpoints. The pooled one is built for an application:
 * many short connections, each held briefly. The direct one is for work that
 * opens a connection and keeps it — migrations, backfills, verification runs.
 * schema.prisma already names DIRECT_URL for migrations; this is the same
 * choice for everything else running outside the server process.
 *
 * A correction, because the commit that introduced this said something wrong.
 *
 * This was written to fix scripts that appeared to fail when run back to back.
 * They were not failing. The scripts print a trailing blank line, the shell loop
 * checking them took `tail -1`, and an empty string was being reported as
 * "(no output — failed)". Three passing scripts were read as three failures, and
 * the pooler was blamed for it.
 *
 * One real connection drop did happen — a single "Server has closed the
 * connection" on one run — which is what made the wrong explanation plausible.
 * Using the direct endpoint is still the right default for scripts, and it may
 * well prevent that drop recurring, but it has not been shown to. It is kept on
 * its own merits, not as a fix for a bug that was never there.
 */

import { PrismaClient } from '@prisma/client';

export function scriptPrisma(): PrismaClient {
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

  return new PrismaClient({
    datasources: { db: { url } },
    // Scripts should say what went wrong. The default logs warnings and errors
    // to stderr, which is where a dropped connection belongs — the first
    // version of this swallowed it and reported an empty line.
    log: ['warn', 'error'],
  });
}
