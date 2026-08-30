/**
 * A Mongoose-shaped façade over the Prisma `users` table.
 *
 * D10 says unify on Postgres. The `users` table has been in Neon since wave 9,
 * but 74 files and 311 call sites still read through the Mongoose model, so the
 * application runs on two databases — which is exactly the thing D10 set out to
 * end, and which surfaced the moment Docker was down and Mongo was gone.
 *
 * Rewriting 311 call sites at once would be one enormous change across the auth
 * path, reviewable by nobody. This instead presents the twelve methods those
 * call sites actually use, backed by Prisma, so files move over one at a time
 * and each move is a one-line import change that the end-to-end suite can
 * check.
 *
 * What it deliberately does NOT do:
 *
 *   - aggregate(). Five call sites use Mongo aggregation pipelines, which do
 *     not translate mechanically to SQL. Pretending otherwise would produce
 *     wrong numbers rather than an error, so it throws and names the caller.
 *   - Mongoose documents. Rows come back as plain objects, always. There is no
 *     .save(), no virtuals, no middleware. A caller relying on those should be
 *     ported properly rather than accommodated.
 */

import { prisma } from '../lib/prisma';

type Doc = Record<string, any>;

/** Mongo filter operators seen in this codebase, translated to Prisma. */
function translateValue(value: any): any {
  if (value === null || typeof value !== 'object' || value instanceof Date) return value;
  if (Array.isArray(value)) return { in: value };

  const out: Record<string, any> = {};
  let translated = false;

  for (const [op, operand] of Object.entries(value)) {
    switch (op) {
      case '$in': out.in = operand; translated = true; break;
      case '$nin': out.notIn = operand; translated = true; break;
      case '$ne': out.not = operand; translated = true; break;
      case '$gt': out.gt = operand; translated = true; break;
      case '$gte': out.gte = operand; translated = true; break;
      case '$lt': out.lt = operand; translated = true; break;
      case '$lte': out.lte = operand; translated = true; break;
      case '$exists':
        // "exists" on a nullable column is "is not null", which is the only
        // sense it ever had here.
        out.not = operand ? null : undefined;
        if (!operand) out.equals = null;
        translated = true;
        break;
      case '$regex': {
        const src = operand instanceof RegExp ? operand.source : String(operand);
        // Anchors and wildcards do not survive a translation to `contains`, and
        // a silently different match is worse than a refusal.
        if (/[\^\$\[\]\(\)\{\}\|\\\+\?]/.test(src)) {
          throw new Error(
            `User query: the regex /${src}/ cannot be translated to Prisma safely. ` +
            `Port this call site by hand.`
          );
        }
        out.contains = src;
        out.mode = 'insensitive';
        translated = true;
        break;
      }
      default:
        break;
    }
  }

  return translated ? out : value;
}

function translateFilter(filter: Doc = {}): Doc {
  const where: Doc = {};

  for (const [key, value] of Object.entries(filter)) {
    if (key === '_id') {
      where.id = translateValue(value);
      continue;
    }
    if (key === '$or' || key === '$and') {
      where[key.slice(1).toUpperCase() === 'OR' ? 'OR' : 'AND'] =
        (value as Doc[]).map(translateFilter);
      continue;
    }
    if (key.includes('.')) {
      throw new Error(
        `User query: nested path "${key}" has no column. Port this call site by hand.`
      );
    }
    where[key] = translateValue(value);
  }

  return where;
}

/** `select('-passwordHash')` and `select('name email')`, as Prisma select. */
function translateSelect(spec: string | Doc | undefined): Doc | undefined {
  if (!spec) return undefined;

  if (typeof spec === 'object') {
    const out: Doc = {};
    for (const [k, v] of Object.entries(spec)) out[k === '_id' ? 'id' : k] = Boolean(v);
    return out;
  }

  const fields = spec.split(/\s+/).filter(Boolean);
  const excluded = fields.filter((f) => f.startsWith('-')).map((f) => f.slice(1));
  const included = fields.filter((f) => !f.startsWith('-'));

  if (included.length) {
    const out: Doc = { id: true };
    for (const f of included) out[f === '_id' ? 'id' : f] = true;
    return out;
  }

  // Exclusion. Prisma has no "everything except", so the omitted fields are
  // stripped after the read rather than in the query — same result, one more
  // column over the wire.
  return { __exclude: excluded } as Doc;
}

function applyExclusion(row: Doc | null, select: Doc | undefined): Doc | null {
  if (!row || !select?.__exclude) return row;
  const out = { ...row };
  for (const f of select.__exclude as string[]) delete out[f];
  return out;
}

/**
 * Rows carry `_id` as well as `id`.
 *
 * The frontend and 300-odd call sites read `_id`; wave 4 already learned that
 * dropping it breaks the app in ways nothing typechecks. Both are present and
 * hold the same value.
 */
function shape(row: Doc | null): Doc | null {
  if (!row) return null;
  return { ...row, _id: row.id };
}

/** A thenable that also answers .select() and .lean(), like a Mongoose query. */
function query<T>(run: (select?: Doc) => Promise<T>) {
  let select: Doc | undefined;

  const chain: any = {
    select(spec: string | Doc) {
      select = translateSelect(spec);
      return chain;
    },
    lean() {
      // Rows are already plain objects. lean() is a no-op that exists so call
      // sites do not have to change.
      return chain;
    },
    then(onFulfilled: any, onRejected: any) {
      return run(select).then(onFulfilled, onRejected);
    },
    catch(onRejected: any) {
      return run(select).catch(onRejected);
    },
  };

  return chain;
}

// Returned as `any` because Prisma's generated argument types treat `select`
// as present-or-absent at the type level, and this decides at runtime. The
// shape is checked by the end-to-end suite instead.
const passthroughSelect = (select?: Doc): any =>
  select && !select.__exclude ? { select } : {};

export const UserPrisma = {
  findById(id: string) {
    return query(async (select) => {
      if (!id) return null;
      const row = await prisma.user.findUnique({
        where: { id },
        ...passthroughSelect(select),
      });
      return shape(applyExclusion(row as Doc, select));
    });
  },

  findOne(filter: Doc = {}) {
    return query(async (select) => {
      const row = await prisma.user.findFirst({
        where: translateFilter(filter),
        ...passthroughSelect(select),
      });
      return shape(applyExclusion(row as Doc, select));
    });
  },

  find(filter: Doc = {}) {
    return query(async (select) => {
      const rows = await prisma.user.findMany({
        where: translateFilter(filter),
        ...passthroughSelect(select),
      });
      return rows.map((r) => shape(applyExclusion(r as Doc, select))) as Doc[];
    });
  },

  async countDocuments(filter: Doc = {}) {
    return prisma.user.count({ where: translateFilter(filter) });
  },

  async create(data: Doc | Doc[]) {
    if (Array.isArray(data)) {
      const made = await Promise.all(data.map((d) => prisma.user.create({ data: d as any })));
      return made.map((m) => shape(m as Doc));
    }
    const made = await prisma.user.create({ data: data as any });
    return shape(made as Doc);
  },

  async insertMany(rows: Doc[]) {
    return this.create(rows);
  },

  async findByIdAndUpdate(id: string, update: Doc, _opts?: Doc) {
    // $set is the only update operator these call sites use; anything else
    // would change values in a way this cannot express, so it is refused.
    const data = update.$set ?? update;
    for (const key of Object.keys(update)) {
      if (key.startsWith('$') && key !== '$set') {
        throw new Error(
          `User update: operator ${key} is not supported by this adapter. ` +
          `Port this call site by hand.`
        );
      }
    }
    const row = await prisma.user.update({ where: { id }, data: data as any });
    return shape(row as Doc);
  },

  async updateMany(filter: Doc, update: Doc) {
    const data = update.$set ?? update;
    return prisma.user.updateMany({ where: translateFilter(filter), data: data as any });
  },

  async deleteMany(filter: Doc = {}) {
    return prisma.user.deleteMany({ where: translateFilter(filter) });
  },

  async findByIdAndDelete(id: string) {
    const row = await prisma.user.delete({ where: { id } });
    return shape(row as Doc);
  },

  async findOneAndDelete(filter: Doc) {
    const found = await prisma.user.findFirst({ where: translateFilter(filter) });
    if (!found) return null;
    const row = await prisma.user.delete({ where: { id: found.id } });
    return shape(row as Doc);
  },

  /**
   * Not implemented, on purpose.
   *
   * The five aggregation pipelines in this codebase group and project in ways
   * that need real SQL. A half-translation would return numbers that look
   * plausible and are wrong, which is worse than nothing working — so this
   * refuses loudly and names what to do instead.
   */
  aggregate(_pipeline: Doc[]): never {
    throw new Error(
      'User.aggregate is not supported by the Prisma adapter. Mongo aggregation ' +
      'pipelines do not translate mechanically to SQL, and a partial translation ' +
      'returns plausible wrong numbers. Write this query as prisma.$queryRaw or ' +
      'a view, the way the Sprint 3 analytics views were done.'
    );
  },
};

export default UserPrisma;
