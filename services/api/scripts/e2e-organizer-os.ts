/**
 * End-to-end test of the Organizer OS, through HTTP.
 *
 * Everything verified so far was either a pure function or a database
 * constraint. This goes through the API the way a browser does: real accounts,
 * real login, real cookies, real authorisation. It is the layer where the bugs
 * this session actually produced were hiding — a wrong path, a query parameter
 * that did not exist, a field the API never sent — none of which a typecheck or
 * a database check would have caught.
 *
 * Creates its own accounts with unique emails, so it can be run repeatedly.
 * Nothing is cleaned up: the rows it leaves are evidence.
 */

import axios, { AxiosInstance } from 'axios';

const BASE = process.env.E2E_BASE ?? 'http://localhost:4000';

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = '') {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

/** A client that keeps cookies, like a browser. */
function makeClient(): AxiosInstance {
  const jar: string[] = [];
  const client = axios.create({
    baseURL: BASE,
    timeout: 30000,
    validateStatus: () => true,
  });
  client.interceptors.request.use((cfg) => {
    if (jar.length) cfg.headers.Cookie = jar.join('; ');
    return cfg;
  });
  client.interceptors.response.use((res) => {
    const set = res.headers['set-cookie'];
    if (set) {
      for (const c of set) {
        const pair = c.split(';')[0];
        const name = pair.split('=')[0];
        const i = jar.findIndex((j) => j.startsWith(`${name}=`));
        if (i >= 0) jar[i] = pair;
        else jar.push(pair);
      }
    }
    return res;
  });
  return client;
}

const stamp = Date.now();
const email = (who: string) => `e2e-${who}-${stamp}@trektribe.test`;
const PASSWORD = 'E2ePass@12345';

// Phones must be unique per run too, not only emails. The first version fixed
// the digits and the second run collided with the first on "Phone number
// already registered" — which then read as forty broken endpoints, because
// nothing after registration had a session.
const phone = (n: number) => '+9198' + String(stamp).slice(-8) + String(n);

async function main() {
  console.log(`Testing against ${BASE}`);

  const organizer = makeClient();
  const traveler = makeClient();
  let organizerId = '';
  let tripId = '';
  let bookingId = '';

  // ── Accounts ───────────────────────────────────────────────────────────────
  section('Real accounts');

  const orgReg = await organizer.post('/auth/register', {
    name: 'E2E Organizer',
    email: email('org'),
    password: PASSWORD,
    role: 'organizer',
    phone: phone(1),
  });
  check('an organizer can register', [200, 201].includes(orgReg.status), `http ${orgReg.status} ${JSON.stringify(orgReg.data).slice(0, 160)}`);
  organizerId = orgReg.data?.user?.id ?? orgReg.data?.user?._id ?? '';

  const travReg = await traveler.post('/auth/register', {
    name: 'E2E Traveler',
    email: email('trav'),
    password: PASSWORD,
    role: 'traveler',
    phone: phone(2),
  });
  check('a traveler can register', [200, 201].includes(travReg.status), `http ${travReg.status}`);

  const orgLogin = await organizer.post('/auth/login', { email: orgReg.data?.user?.email, password: PASSWORD });
  check('the organizer can log in', orgLogin.status === 200, `http ${orgLogin.status}`);

  // A newly registered organizer cannot create trips until an admin approves
  // them — verifyOrganizerApproved refuses with 403 and says so. That guard is
  // correct, and the first run of this test proved it works by failing here.
  //
  // But leaving it there meant the whole Sprint 4 section never ran, so the
  // draft-and-publication assertions were silently untested. Approving the
  // organizer as an admin is what lets those actually execute — a guard that
  // blocks coverage has to be gone through, not around.
  // Public registration refuses role=admin outright:
  //
  //   "Admins and agents must be created by system administrators."
  //
  // That is correct and worth asserting rather than working around — a public
  // endpoint that let a caller name themselves admin would be the most serious
  // thing in this file. So the test proves the refusal, then creates the admin
  // the way the system intends: directly, the way create-admin-agent.ts does.
  const admin = makeClient();
  const selfPromote = await admin.post('/auth/register', {
    name: 'E2E Admin',
    email: email('admin-attempt'),
    password: PASSWORD,
    role: 'admin',
    phone: phone(3),
  });
  check('registering yourself as admin is REFUSED', selfPromote.status === 400,
    `http ${selfPromote.status} — a public path to admin would be a serious hole`);

  // Approving the organizer needs an admin, and an admin can only be created
  // directly in the database. When the API runs on an in-memory Mongo that
  // database lives inside the API process, so this script cannot reach it.
  //
  // E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD let a real admin be supplied when
  // one exists — against a shared Mongo, or a seeded environment. Without them
  // the trip section is SKIPPED and said to be skipped, rather than failing in
  // a way that reads like a broken endpoint, or passing in a way that claims
  // coverage this run does not have.
  let organizerApproved = false;
  const adminEmailEnv = process.env.E2E_ADMIN_EMAIL;
  const adminPassEnv = process.env.E2E_ADMIN_PASSWORD;

  if (adminEmailEnv && adminPassEnv) {
    const adminLogin = await admin.post('/auth/login', {
      email: adminEmailEnv,
      password: adminPassEnv,
    });
    const adminReady = adminLogin.status === 200;
    check('the supplied admin can log in', adminReady, `http ${adminLogin.status}`);

    if (adminReady && organizerId) {
      const approve = await admin.post(`/admin/organizer-verifications/${organizerId}/approve`, {});
      organizerApproved = [200, 201].includes(approve.status);
      check('an admin can approve the organizer', organizerApproved,
        `http ${approve.status} ${String(JSON.stringify(approve.data)).slice(0, 140)}`);
    }
  } else {
    console.log(
      '  SKIP  trip creation and publication — no admin supplied.\n' +
      '        A new organizer cannot create trips until an admin approves them,\n' +
      '        and an admin can only be made directly in the database. Set\n' +
      '        E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD against a shared Mongo to\n' +
      '        cover this section.'
    );
  }

  // ── The endpoints every new screen calls ───────────────────────────────────
  // This is the check that would have caught the /analytics vs /api/analytics
  // bug and the /trips?mine=true bug, both of which typechecked cleanly.
  section('Every screen endpoint answers');

  const GETS: [string, string][] = [
    ['trips (mine)', '/trips/mine'],
    ['analytics occupancy', '/api/analytics/occupancy'],
    ['analytics profitability', '/api/analytics/profitability'],
    ['analytics customers', '/api/analytics/customers'],
    ['analytics marketing', '/api/analytics/marketing'],
    ['trip templates', '/trips/templates/list'],
    ['trip series', '/trips/series/list'],
    ['ops checklist templates', '/api/ops/checklist-templates'],
    ['ops certifications', '/api/ops/certifications'],
    ['ops documents', '/api/ops/documents'],
    ['finance reconciliation', '/api/finance/reconciliation'],
    ['finance cash flow', '/api/finance/cash-flow'],
    ['finance payout readiness', '/api/finance/payout-readiness'],
    ['team', '/api/team'],
    ['team invites', '/api/team/invites'],
    ['team my-scope', '/api/team/my-scope'],
    ['marketing banners', '/api/marketing/banners'],
    ['marketing campaigns', '/api/marketing/campaigns'],
    ['marketing referrals', '/api/marketing/referrals'],
    ['marketing review-requests', '/api/marketing/review-requests'],
    ['marketing customers', '/api/marketing/customers'],
    ['marketing discount-floor', '/api/marketing/discount-floor'],
    ['marketing coupons', '/api/marketing/coupons'],
    ['ai status', '/api/ai-studio/status'],
    ['ai drafts', '/api/ai-studio/drafts'],
    ['ai spend', '/api/ai-studio/spend'],
  ];

  for (const [label, path] of GETS) {
    const r = await organizer.get(path);
    check(`GET ${path}`, r.status === 200, `http ${r.status} ${String(JSON.stringify(r.data)).slice(0, 120)}`);
  }

  // ── Sprint 4: publication ──────────────────────────────────────────────────
  if (organizerApproved) {
  section('Sprint 4 — a trip is born a draft and the public cannot see it');

  const created = await organizer.post('/trips', {
    title: `E2E trip ${stamp}`,
    description: 'Created by the end-to-end test',
    destination: 'Test Valley',
    capacity: 4,
    price: 5000,
    startDate: new Date(Date.now() + 30 * 86400000).toISOString(),
    endDate: new Date(Date.now() + 33 * 86400000).toISOString(),
    categories: ['trekking'],
  });
  const madeTrip = [200, 201].includes(created.status);
  check('the organizer can create a trip', madeTrip, `http ${created.status} ${String(JSON.stringify(created.data)).slice(0, 200)}`);
  tripId = created.data?._id ?? created.data?.id ?? created.data?.trip?._id ?? '';

  if (madeTrip && tripId) {
    const mine = await organizer.get('/trips/mine');
    const row = (mine.data ?? []).find((t: any) => t.id === tripId);
    check('the new trip appears in the organizer own list', Boolean(row));
    check('and it is a draft', row?.publicationStatus === 'draft', `got ${row?.publicationStatus}`);
    check('with derived state the API actually sends', typeof row?.effectiveStatus === 'string' && typeof row?.fillPct === 'number',
      `effectiveStatus=${row?.effectiveStatus} fillPct=${row?.fillPct}`);

    const publicList = await traveler.get('/trips');
    const publicRows = Array.isArray(publicList.data) ? publicList.data : publicList.data?.trips ?? [];
    check('a draft is NOT in the public listing', !publicRows.some((t: any) => (t._id ?? t.id) === tripId));

    const pub = await organizer.post(`/trips/${tripId}/publication`, { publicationStatus: 'published' });
    check('the organizer can publish it', pub.status === 200, `http ${pub.status}`);

    const dup = await organizer.post(`/trips/${tripId}/duplicate`);
    check('the organizer can duplicate it', [200, 201].includes(dup.status), `http ${dup.status}`);
    check('the duplicate is a draft', dup.data?.publicationStatus === 'draft', `got ${dup.data?.publicationStatus}`);
    check('the duplicate points back at the original', dup.data?.duplicatedFromTripId === tripId);
    check('the duplicate has no slug of its own', dup.data?.slug === null);
  }

  } // end of the organizer-approved block

  // ── Sprint 7: the discount floor, end to end ───────────────────────────────
  section('Sprint 7 — coupons refuse until a floor exists');

  const floorBefore = await organizer.get('/api/marketing/discount-floor');
  check('with no floor set, coupons are reported unusable', floorBefore.data?.couponsUsable === false,
    JSON.stringify(floorBefore.data));

  const quoteNoFloor = await organizer.post('/api/marketing/coupons/quote', {
    basePaise: 1000000,
    codes: ['ANY'],
  });
  check('a quote with no floor refuses and charges full price',
    quoteNoFloor.data?.netPaise === 1000000 && typeof quoteNoFloor.data?.refused === 'string',
    JSON.stringify(quoteNoFloor.data).slice(0, 200));

  const setFloor = await organizer.put('/api/marketing/discount-floor', {
    kind: 'max_total_percent',
    value: 40,
  });
  check('the organizer can set a floor', setFloor.status === 200, `http ${setFloor.status}`);

  await organizer.post('/api/marketing/coupons', {
    code: `HALF${stamp}`.slice(0, 12),
    kind: 'percent',
    percentOff: 50,
    startsAt: new Date(Date.now() - 3600000).toISOString(),
  });
  await organizer.post('/api/marketing/coupons', {
    code: `HALFB${stamp}`.slice(0, 12),
    kind: 'percent',
    percentOff: 50,
    startsAt: new Date(Date.now() - 3600000).toISOString(),
  });

  const stacked = await organizer.post('/api/marketing/coupons/quote', {
    basePaise: 1000000,
    codes: [`HALF${stamp}`.slice(0, 12), `HALFB${stamp}`.slice(0, 12)],
  });
  check('two 50% coupons do NOT make it free — the floor holds over HTTP',
    stacked.data?.netPaise === 600000,
    `net=${stacked.data?.netPaise} discount=${stacked.data?.totalDiscountPaise}`);
  check('and the floor is reported as having bound the total', stacked.data?.floorApplied === true);

  // ── Sprint 9: AI refuses before spending ───────────────────────────────────
  section('Sprint 9 — AI refuses before any spend');

  const aiStatus = await organizer.get('/api/ai-studio/status');
  check('AI reports it cannot generate', aiStatus.data?.canGenerate === false, JSON.stringify(aiStatus.data).slice(0, 160));
  check('and says why', typeof aiStatus.data?.blockedBecause === 'string');

  const gen = await organizer.post('/api/ai-studio/generate', {
    feature: 'marketing_copy',
    inputs: { brief: 'A weekend trek' },
  });
  check('generating is refused, not errored', gen.status === 200 && gen.data?.status === 'refused',
    `http ${gen.status} status=${gen.data?.status}`);
  check('the refusal carries a code', typeof gen.data?.refusalCode === 'string', String(gen.data?.refusalCode));

  const escalated = await organizer.post('/api/ai-studio/generate', {
    feature: 'marketing_copy',
    inputs: { brief: 'Customer wants a refund for their booking' },
  });
  check('a refund question escalates rather than generating',
    escalated.data?.refusalCode === 'escalated_to_human',
    String(escalated.data?.refusalCode));

  // ── Authorisation ──────────────────────────────────────────────────────────
  section('Authorisation — a traveler cannot reach organizer surfaces');

  const forbidden = [
    '/api/finance/reconciliation',
    '/api/team',
    '/api/marketing/coupons',
    '/api/ai-studio/status',
    '/trips/mine',
  ];
  for (const path of forbidden) {
    const r = await traveler.get(path);
    check(`a traveler is refused ${path}`, r.status === 401 || r.status === 403, `http ${r.status}`);
  }

  const anonymous = makeClient();
  for (const path of ['/api/team', '/api/finance/cash-flow', '/api/ai-studio/status']) {
    const r = await anonymous.get(path);
    check(`an anonymous caller is refused ${path}`, r.status === 401 || r.status === 403, `http ${r.status}`);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error('ERROR:', e.message);
  process.exit(1);
});
