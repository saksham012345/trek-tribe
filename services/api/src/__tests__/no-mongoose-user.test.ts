/**
 * No runtime code may read users out of MongoDB.
 *
 * Neon is the source of truth for users. Atlas still holds the pre-cutover copy,
 * and it is frozen — so any code that still asks Mongo about a user is reading a
 * snapshot that stops being true the moment the first write lands in Neon.
 *
 * This is a grep, not a type check, on purpose. Eight call sites survived the
 * migration precisely because they used a lazy `require()` inside a function
 * body: no top-level import to find, and nothing for the compiler to object to.
 * Three of them would have returned 404 on a live endpoint — posting a support
 * message, resolving a ticket, creating a Razorpay account — because they look
 * up a Neon UUID in a collection keyed by ObjectId. A fourth looked users up by
 * email, which still matches in Atlas, and would have written a stale ObjectId
 * into Neon as a userId.
 *
 * A test that reads the source is the only kind that catches the next one.
 */

import fs from 'fs';
import path from 'path';

const SRC = path.join(__dirname, '..');

/** Everything that ships. Tests and one-off scripts may still touch Mongoose. */
function runtimeFiles(dir: string, found: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'scripts' || entry.name === 'cli') continue;
      runtimeFiles(full, found);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      // The model file itself is allowed to exist; nothing runtime may reach it.
      if (full.endsWith(path.join('models', 'User.ts'))) continue;
      found.push(full);
    }
  }
  return found;
}

describe('users come from Postgres, everywhere', () => {
  const files = runtimeFiles(SRC);

  it('finds the runtime source to check', () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it('no runtime file imports or requires the Mongoose User model', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      source.split('\n').forEach((line, i) => {
        // Matches both `from '../models/User'` and `require('../models/User')`,
        // at any depth, without matching userPrismaAdapter.
        if (/['"](?:\.\.\/)*models\/User['"]/.test(line)) {
          offenders.push(`${path.relative(SRC, file)}:${i + 1}  ${line.trim()}`);
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});
