# Local setup — the parts that are not obvious

Written 2026-08-22, after all five of these cost time to rediscover.

## Install

```bash
npm install --legacy-peer-deps
npx prisma generate
```

**`npm ci` does not work here.** The lockfile is out of sync with `package.json`
(`Missing: openapi-types@12.1.3 from lock file`), so `npm ci` refuses outright.

**`npm install` alone fails** with `ERESOLVE`:

```
Found: redis@4.7.1                          (this project pins ^4.6.0)
peerOptional redis@">=5.0.0" from bullmq@6.0.5
```

`--legacy-peer-deps` is correct here, not a workaround. The peer is **optional**,
and bullmq drives its queues through `ioredis`, which is installed and satisfied.
The `redis@4` dependency exists for `src/services/redisService.ts`, which uses the
node-redis v4 `createClient` API.

**Do not "fix" this by upgrading redis to v5** — that breaks `redisService.ts`, and
buys nothing, because bullmq never touches that client.

## Ports — both differ from the defaults

| Service | Container port | **Host port** |
|---|---|---|
| Postgres | 5432 | **5433** |
| Redis | 6379 | **6380** |

`.env.example` carried the container ports for both until 2026-08-22. Two traps:

- Postgres on 5432 just fails to connect. Obvious enough.
- **Redis on 6379 is worse.** Another project's Redis may be listening there
  (a Chatwoot stack was, on this machine). The connection *succeeds* and then
  fails with `NOAUTH Authentication required`, which reads exactly like this
  project's Redis password being wrong. It isn't — it is the wrong Redis.

## Running the Vendor OS tests

```bash
export DATABASE_URL="postgresql://trektribe:trek-tribe-postgres-pass@localhost:5433/trektribe"
export DIRECT_URL="$DATABASE_URL"
export REDIS_URL="redis://:trek-tribe-redis-pass@localhost:6380"
npx jest --config jest.config.js --runInBand --testPathPattern="(vendor|Vendor|tripVendor)"
```

Expected: **7 suites, 26 tests, all passing.** The plan said six test files; there
are seven.

Both services must be up:

```bash
docker start vendor-management-postgres-1 vendor-management-redis
docker exec vendor-management-postgres-1 pg_isready -U trektribe -d trektribe
docker exec vendor-management-redis redis-cli -a trek-tribe-redis-pass PING
```

## Two databases

This service talks to **both** MongoDB and Postgres. Vendor OS (7 Prisma models)
is on Postgres; the other 41 Mongoose models are on MongoDB. `vendorEventRelay.ts`
touches both in one function.

Per D10 this is being unified onto Postgres, domain by domain.

## Set all three, every time

`DIRECT_URL` is required as well as `DATABASE_URL` - `prisma validate` refuses
to load the schema without it, because `datasource db` declares both.

And set `REDIS_URL` even for a run that looks like it has nothing to do with
Redis. I left it out of a full test run and four suites failed with
`NOAUTH Authentication required` - which is the trap described above, hit
exactly as written: with no `REDIS_URL`, ioredis connects to localhost:6379,
reaches a different project's Redis, and reports what looks like a wrong
password for this one. The suites that failed were the ones using bullmq, and
nothing about their names suggests Redis.
