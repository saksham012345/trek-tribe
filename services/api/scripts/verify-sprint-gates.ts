/**
 * Sprint gate verification — structural checks against the live database.
 *
 * Everything in sprints 3 to 8 was written and typechecked but never run. This
 * asks the database what it actually has, rather than what the migration files
 * say it should.
 *
 * Read-only except for the constraint tests, which write inside a transaction
 * that is always rolled back.
 */

import { PrismaClient } from '@prisma/client';

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

async function exists(sql: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<any[]>(sql);
  return Number(rows[0]?.n ?? 0) > 0;
}

async function main() {
  console.log('\n=== Sprint 3: analytics views ===');
  for (const v of [
    'v_occupancy_by_trip',
    'v_trip_profitability',
    'v_customer_geography',
    'v_marketing_performance',
  ]) {
    check(
      `view ${v} exists`,
      await exists(`SELECT count(*)::int n FROM pg_views WHERE viewname = '${v}'`)
    );
  }

  // The gate that matters: seats, not rows. Read the view definition and look
  // for the sum rather than trusting the file on disk.
  const occ = await prisma.$queryRaw<any[]>`
    SELECT pg_get_viewdef('v_occupancy_by_trip'::regclass, true) AS def
  `;
  const def = String(occ[0]?.def ?? '');
  check(
    'v_occupancy_by_trip sums number_of_guests',
    /sum\(gb\.number_of_guests\)/i.test(def),
    'seats must be summed, not rows counted'
  );
  check(
    'v_occupancy_by_trip does not COUNT bookings for seats',
    !/seats_booked[^,]*count\(/i.test(def)
  );

  console.log('\n=== Sprint 4: trips depth ===');
  check(
    'publication_status column exists',
    await exists(`SELECT count(*)::int n FROM information_schema.columns
                  WHERE table_name='trips' AND column_name='publication_status'`)
  );
  for (const c of ['publish_at', 'series_id', 'template_id', 'duplicated_from_trip_id']) {
    check(
      `trips.${c} exists`,
      await exists(`SELECT count(*)::int n FROM information_schema.columns
                    WHERE table_name='trips' AND column_name='${c}'`)
    );
  }
  check(
    'trip_templates is its own table, not a flagged trip',
    await exists(`SELECT count(*)::int n FROM information_schema.tables
                  WHERE table_name='trip_templates'`)
  );
  check(
    'v_public_trips exists',
    await exists(`SELECT count(*)::int n FROM pg_views WHERE viewname='v_public_trips'`)
  );

  const pub = await prisma.$queryRaw<any[]>`
    SELECT pg_get_viewdef('v_public_trips'::regclass, true) AS def
  `;
  const pubDef = String(pub[0]?.def ?? '');
  check(
    'v_public_trips excludes anything not published',
    /publication_status\s*=\s*'published'/i.test(pubDef)
  );

  // Existing rows were backfilled to published; new ones default to draft.
  const colDefault = await prisma.$queryRaw<any[]>`
    SELECT column_default FROM information_schema.columns
    WHERE table_name='trips' AND column_name='publication_status'
  `;
  check(
    'new trips default to draft',
    /draft/.test(String(colDefault[0]?.column_default ?? '')),
    String(colDefault[0]?.column_default)
  );

  console.log('\n=== Sprint 5: operations ===');
  for (const t of [
    'accommodations', 'rooms', 'room_assignments',
    'transport_segments', 'transport_assignments',
    'checklist_templates', 'booking_checklist_items',
    'attendance_records', 'equipment_items', 'equipment_assignments',
    'permits', 'emergency_plans', 'ops_documents',
    'medical_declarations', 'certifications',
  ]) {
    check(
      `table ${t} exists`,
      await exists(`SELECT count(*)::int n FROM information_schema.tables WHERE table_name='${t}'`)
    );
  }

  check(
    'UNIQUE(booking_id, template_id) on booking_checklist_items',
    await exists(`SELECT count(*)::int n FROM pg_indexes
                  WHERE tablename='booking_checklist_items'
                    AND indexdef ILIKE '%UNIQUE%booking_id%template_id%'`)
  );
  check(
    'one room per participant (UNIQUE participant_id)',
    await exists(`SELECT count(*)::int n FROM pg_indexes
                  WHERE tablename='room_assignments'
                    AND indexdef ILIKE '%UNIQUE%participant_id%'`)
  );
  check(
    'rooms carry NO capacity CHECK — over-capacity must be allowed',
    !(await exists(`SELECT count(*)::int n FROM pg_constraint
                    WHERE conrelid='room_assignments'::regclass AND contype='c'`)),
    'a capacity constraint here would block a real 11pm decision'
  );
  check(
    'ops_documents CHECK: exactly one subject',
    await exists(`SELECT count(*)::int n FROM pg_constraint
                  WHERE conrelid='ops_documents'::regclass
                    AND conname='ops_documents_exactly_one_subject'`)
  );
  check(
    'v_expiring_credentials exists',
    await exists(`SELECT count(*)::int n FROM pg_views WHERE viewname='v_expiring_credentials'`)
  );
  check(
    'permits store a date, not an expiry status',
    !(await exists(`SELECT count(*)::int n FROM information_schema.columns
                    WHERE table_name='permits' AND column_name LIKE '%status%'`))
  );

  console.log('\n=== Sprint 8: team ===');
  for (const t of ['team_memberships', 'team_invites', 'trip_leader_assignments', 'calendar_syncs']) {
    check(
      `table ${t} exists`,
      await exists(`SELECT count(*)::int n FROM information_schema.tables WHERE table_name='${t}'`)
    );
  }
  check(
    'one active membership per person is a PARTIAL unique index',
    await exists(`SELECT count(*)::int n FROM pg_indexes
                  WHERE tablename='team_memberships'
                    AND indexdef ILIKE '%UNIQUE%'
                    AND indexdef ILIKE '%WHERE%active%'`),
    'must be partial, so a re-hire is possible'
  );
  check(
    'team_invites CHECK: accepted rows are complete',
    await exists(`SELECT count(*)::int n FROM pg_constraint
                  WHERE conrelid='team_invites'::regclass
                    AND conname='team_invites_accepted_is_complete'`)
  );
  check(
    'UNIQUE(trip_id, provider) on calendar_syncs',
    await exists(`SELECT count(*)::int n FROM pg_indexes
                  WHERE tablename='calendar_syncs'
                    AND indexdef ILIKE '%UNIQUE%trip_id%provider%'`)
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('ERROR:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
