/**
 * Sprint gate verification — behavioural.
 *
 * The structural pass proved the constraints exist. This proves they bite.
 * A CHECK that is present but permissive, or a unique index on the wrong
 * columns, passes "does it exist" and fails the thing it was written for.
 *
 * Everything runs inside one transaction that is always rolled back, so this
 * leaves the database exactly as it found it.
 */

import { Prisma } from '@prisma/client';
import { scriptPrisma } from './_scriptPrisma';

const prisma = scriptPrisma();

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

/**
 * Assert that a write is refused by the database.
 *
 * Wrapped in a SAVEPOINT because Postgres aborts the whole transaction on the
 * first failed statement — catching the error in JavaScript is not enough, the
 * connection stays poisoned and every later statement returns 25P02. Rolling
 * back to the savepoint undoes only the statement that was supposed to fail.
 */
let savepointSeq = 0;
async function refuses(
  tx: Prisma.TransactionClient,
  label: string,
  fn: () => Promise<unknown>
) {
  const sp = `sp_${++savepointSeq}`;
  await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
  try {
    await fn();
    await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
    check(label, false, 'the write was ACCEPTED when it should have been refused');
  } catch {
    await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
    check(label, true);
  }
}

/** Assert that a write is allowed. */
async function allows(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(label, true);
  } catch (e: any) {
    check(label, false, `refused: ${e.message?.split('\n')[0]}`);
  }
}

class Rollback extends Error {}

async function main() {
  try {
    await prisma.$transaction(
      async (tx) => {
        const uid = () => `verify-${Math.random().toString(36).slice(2, 10)}`;

        // ── Fixtures ────────────────────────────────────────────────────────
        const organizerId = uid();
        const trip = await tx.trip.create({
          data: {
            organizerId,
            title: 'Gate verification trip',
            description: 'temporary',
            destination: 'Nowhere',
            capacity: 4,
            price: new Prisma.Decimal(1000),
            startDate: new Date(Date.now() + 86400000),
            endDate: new Date(Date.now() + 172800000),
          },
        });

        console.log('\n=== Sprint 4: publication defaults ===');
        check(
          'a newly created trip is draft, not published',
          trip.publicationStatus === 'draft',
          `got ${trip.publicationStatus}`
        );

        const publicRows = await tx.$queryRaw<any[]>`
          SELECT count(*)::int n FROM v_public_trips WHERE id = ${trip.id}
        `;
        check(
          'a draft trip is absent from v_public_trips',
          Number(publicRows[0].n) === 0,
          'drafts must not be publicly listable'
        );

        await tx.trip.update({
          where: { id: trip.id },
          data: { publicationStatus: 'published' },
        });
        const nowPublic = await tx.$queryRaw<any[]>`
          SELECT count(*)::int n FROM v_public_trips WHERE id = ${trip.id}
        `;
        check(
          'publishing makes it appear in v_public_trips',
          Number(nowPublic[0].n) === 1
        );

        // A scheduled trip with a future publish_at must stay hidden.
        await tx.trip.update({
          where: { id: trip.id },
          data: { publicationStatus: 'published', publishAt: new Date(Date.now() + 86400000) },
        });
        const scheduled = await tx.$queryRaw<any[]>`
          SELECT count(*)::int n FROM v_public_trips WHERE id = ${trip.id}
        `;
        check(
          'published-but-not-yet-live stays out of v_public_trips',
          Number(scheduled[0].n) === 0,
          'publish_at in the future must still hide it'
        );
        await tx.trip.update({ where: { id: trip.id }, data: { publishAt: null } });

        console.log('\n=== Sprint 3: occupancy counts seats, not bookings ===');
        const booker = uid();
        const booking = await tx.groupBooking.create({
          data: {
            tripId: trip.id,
            mainBookerId: booker,
            numberOfGuests: 3, // one booking, three seats
            totalAmount: new Prisma.Decimal(3000),
            pricePerPerson: new Prisma.Decimal(1000),
            finalAmount: new Prisma.Decimal(3000),
            paidAmount: new Prisma.Decimal(3000),
            paymentMethod: 'upi',
            bookingStatus: 'confirmed',
          },
        });

        const occ = await tx.$queryRaw<any[]>`
          SELECT seats_booked, booking_count FROM v_occupancy_by_trip WHERE trip_id = ${trip.id}
        `;
        check(
          'one booking of three guests reads as 3 seats, not 1',
          Number(occ[0].seats_booked) === 3,
          `seats_booked = ${occ[0]?.seats_booked}`
        );
        check(
          'booking_count still reports 1',
          Number(occ[0].booking_count) === 1
        );

        console.log('\n=== Sprint 3: geography reconciles exactly ===');
        const geo = await tx.$queryRaw<any[]>`
          SELECT COALESCE(SUM(lifetime_spend), 0) AS parts FROM v_customer_geography
          WHERE organizer_id = ${organizerId}
        `;
        const total = await tx.$queryRaw<any[]>`
          SELECT COALESCE(SUM(COALESCE(paid_amount,0)), 0) AS whole
          FROM group_bookings gb JOIN trips t ON t.id = gb.trip_id
          WHERE t.organizer_id = ${organizerId}
            AND gb.booking_status IN ('confirmed','completed')
        `;
        check(
          'placed + unplaced equals total lifetime spend, exactly',
          String(geo[0].parts) === String(total[0].whole),
          `${geo[0].parts} vs ${total[0].whole}`
        );

        console.log('\n=== Sprint 5: checklist toggling ===');
        const tpl = await tx.checklistTemplate.create({
          data: { organizerId, label: 'Waiver signed' },
        });
        for (let i = 0; i < 3; i++) {
          await tx.bookingChecklistItem.upsert({
            where: { bookingId_templateId: { bookingId: booking.id, templateId: tpl.id } },
            create: { bookingId: booking.id, templateId: tpl.id, isDone: i % 2 === 0 },
            update: { isDone: i % 2 === 0 },
          });
        }
        const items = await tx.bookingChecklistItem.count({
          where: { bookingId: booking.id, templateId: tpl.id },
        });
        check('toggling three times leaves exactly one row', items === 1, `${items} rows`);

        await refuses(tx, 'a second row for the same (booking, template) is refused', () =>
          tx.bookingChecklistItem.create({
            data: { bookingId: booking.id, templateId: tpl.id, isDone: false },
          })
        );

        console.log('\n=== Sprint 5: rooms — duplicate refused, over-capacity allowed ===');
        const acc = await tx.accommodation.create({
          data: { tripId: trip.id, name: 'Base camp' },
        });
        const room = await tx.room.create({
          data: { accommodationId: acc.id, label: 'R1', capacity: 1 },
        });
        const p1 = await tx.bookingParticipant.create({
          data: {
            bookingId: booking.id, name: 'A', email: `${uid()}@x.com`, phone: '1',
            emergencyContactName: 'E', emergencyContactPhone: '2', experienceLevel: 'beginner',
          },
        });
        const p2 = await tx.bookingParticipant.create({
          data: {
            bookingId: booking.id, name: 'B', email: `${uid()}@x.com`, phone: '1',
            emergencyContactName: 'E', emergencyContactPhone: '2', experienceLevel: 'beginner',
          },
        });

        await allows('first participant into a 1-bed room', () =>
          tx.roomAssignment.create({ data: { roomId: room.id, participantId: p1.id } })
        );
        await allows('second participant into the SAME 1-bed room — over capacity, allowed', () =>
          tx.roomAssignment.create({ data: { roomId: room.id, participantId: p2.id } })
        );
        await refuses(tx, 'the same participant assigned twice is refused', () =>
          tx.roomAssignment.create({ data: { roomId: room.id, participantId: p1.id } })
        );

        console.log('\n=== Sprint 5: document subject CHECK ===');
        await refuses(tx, 'a document with no subject is refused', () =>
          tx.opsDocument.create({
            data: { organizerId, title: 'orphan', fileUrl: 'http://x/y' },
          })
        );
        await refuses(tx, 'a document with two subjects is refused', () =>
          tx.opsDocument.create({
            data: {
              organizerId, title: 'ambiguous', fileUrl: 'http://x/y',
              tripId: trip.id, participantId: p1.id,
            },
          })
        );
        await allows('a document with exactly one subject is accepted', () =>
          tx.opsDocument.create({
            data: { organizerId, title: 'fine', fileUrl: 'http://x/y', tripId: trip.id },
          })
        );

        console.log('\n=== Sprint 5: expiry is derived, and reads "expired" ===');
        await tx.permit.create({
          data: {
            tripId: trip.id, name: 'Forest entry',
            expiresOn: new Date(Date.now() - 86400000 * 3),
          },
        });
        const expired = await tx.$queryRaw<any[]>`
          SELECT expiry_state FROM v_expiring_credentials
          WHERE scope_id = ${trip.id} AND kind = 'permit'
        `;
        check(
          'a permit whose date has passed reads "expired"',
          expired[0]?.expiry_state === 'expired',
          `got ${expired[0]?.expiry_state}`
        );

        console.log('\n=== Sprint 8: one active membership, re-hire allowed ===');
        const person = uid();
        const m1 = await tx.teamMembership.create({
          data: { organizerId, userId: person, role: 'trip_leader', status: 'active' },
        });
        await refuses(tx, 'a second ACTIVE membership for the same person is refused', () =>
          tx.teamMembership.create({
            data: { organizerId, userId: person, role: 'viewer', status: 'active' },
          })
        );
        await tx.teamMembership.update({
          where: { id: m1.id },
          data: { status: 'removed', removedAt: new Date() },
        });
        await allows('after removal, the same person can be re-hired', () =>
          tx.teamMembership.create({
            data: { organizerId, userId: person, role: 'viewer', status: 'active' },
          })
        );

        console.log('\n=== Sprint 8: invites cannot be half-accepted ===');
        await refuses(tx, 'accepted_at without user_id is refused', () =>
          tx.$executeRaw`
            INSERT INTO team_invites (id, organizer_id, email, role, token, expires_at, accepted_at, updated_at)
            VALUES (${uid()}, ${organizerId}, 'a@b.com', 'viewer', ${uid()}, NOW(), NOW(), NOW())
          `
        );
        await refuses(tx, 'an accepted invite that still holds its token is refused', () =>
          tx.$executeRaw`
            INSERT INTO team_invites (id, organizer_id, email, role, token, expires_at, accepted_at, user_id, updated_at)
            VALUES (${uid()}, ${organizerId}, 'a@b.com', 'viewer', ${uid()}, NOW(), NOW(), ${person}, NOW())
          `
        );

        console.log('\n=== Sprint 8: calendar push updates, never duplicates ===');
        for (let i = 0; i < 3; i++) {
          await tx.calendarSync.upsert({
            where: { tripId_provider: { tripId: trip.id, provider: 'google' } },
            create: { tripId: trip.id, provider: 'google', externalEventId: `evt-${i}` },
            update: { externalEventId: `evt-${i}`, lastPushedAt: new Date() },
          });
        }
        const syncs = await tx.calendarSync.count({ where: { tripId: trip.id } });
        check('three pushes leave one calendar row', syncs === 1, `${syncs} rows`);

        console.log('\n=== Sprint 7: banner state derived from its window ===');
        const past = await tx.banner.create({
          data: {
            organizerId, title: 'Old sale',
            startsAt: new Date(Date.now() - 86400000 * 10),
            endsAt: new Date(Date.now() - 86400000 * 2),
          },
        });
        const future = await tx.banner.create({
          data: {
            organizerId, title: 'Next sale',
            startsAt: new Date(Date.now() + 86400000 * 2),
          },
        });
        const live = await tx.banner.create({
          data: {
            organizerId, title: 'Running now',
            startsAt: new Date(Date.now() - 3600000),
            endsAt: new Date(Date.now() + 86400000),
          },
        });
        const states = await tx.$queryRaw<any[]>`
          SELECT id, state FROM v_banner_state WHERE organizer_id = ${organizerId}
        `;
        const stateOf = (id: string) => states.find((s) => s.id === id)?.state;
        check('a finished window reads "expired"', stateOf(past.id) === 'expired', String(stateOf(past.id)));
        check('a future window reads "scheduled"', stateOf(future.id) === 'scheduled', String(stateOf(future.id)));
        check('a current window reads "live"', stateOf(live.id) === 'live', String(stateOf(live.id)));

        await refuses(tx, 'a banner ending before it starts is refused', () =>
          tx.banner.create({
            data: {
              organizerId, title: 'Backwards',
              startsAt: new Date(Date.now() + 86400000),
              endsAt: new Date(Date.now()),
            },
          })
        );

        console.log('\n=== Sprint 7: review requests are idempotent ===');
        for (let i = 0; i < 3; i++) {
          await tx.reviewRequest.upsert({
            where: { bookingId: booking.id },
            create: { organizerId, bookingId: booking.id, tripId: trip.id },
            update: { reminderCount: { increment: 1 }, remindedAt: new Date() },
          });
        }
        const requests = await tx.reviewRequest.count({ where: { bookingId: booking.id } });
        check('asking three times leaves one review request', requests === 1, `${requests} rows`);
        await refuses(tx, 'a second request for the same booking is refused', () =>
          tx.reviewRequest.create({
            data: { organizerId, bookingId: booking.id, tripId: trip.id },
          })
        );
        await refuses(tx, 'a response without a review id is refused', () =>
          tx.$executeRaw`
            UPDATE review_requests SET responded_at = NOW() WHERE booking_id = ${booking.id}
          `
        );

        console.log('\n=== Sprint 7: notes are append-only ===');
        const note = await tx.customerNote.create({
          data: { organizerId, bookingId: booking.id, body: 'Called, no answer', authorId: organizerId },
        });
        await tx.customerNote.create({
          data: { organizerId, bookingId: booking.id, body: 'Called again, spoke', authorId: organizerId },
        });
        const reread = await tx.customerNote.findUnique({ where: { id: note.id } });
        check(
          'adding a note leaves the earlier one byte-identical',
          reread?.body === 'Called, no answer' &&
            reread?.createdAt.getTime() === note.createdAt.getTime()
        );
        await refuses(tx, 'updating a note is refused by the database itself', () =>
          tx.$executeRaw`UPDATE customer_notes SET body = 'rewritten' WHERE id = ${note.id}`
        );
        await refuses(tx, 'deleting a note is refused by the database itself', () =>
          tx.$executeRaw`DELETE FROM customer_notes WHERE id = ${note.id}`
        );
        await refuses(tx, 'a note with no subject is refused', () =>
          tx.customerNote.create({ data: { organizerId, body: 'orphan', authorId: organizerId } })
        );

        console.log('\n=== Sprint 7: CRM list is derived from bookings ===');
        // main_booker_id here is a made-up id with no users row, which is
        // exactly the gate: a customer with no profile must still appear.
        const crm = await tx.$queryRaw<any[]>`
          SELECT customer_id, profile_missing, bookings, seats, lifetime_spend
          FROM v_crm_customers WHERE organizer_id = ${organizerId}
        `;
        const row = crm.find((c) => c.customer_id === booker);
        check('a customer with no profile row still appears', Boolean(row));
        check('and is flagged as having no profile', row?.profile_missing === true);
        check('with seats counted from the booking', Number(row?.seats) === 3, `seats=${row?.seats}`);

        throw new Rollback();
      },
      { timeout: 120000 }
    );
  } catch (e) {
    if (!(e instanceof Rollback)) throw e;
  }

  console.log('\n(all writes rolled back)');
  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error('ERROR:', e.message);
  await prisma.$disconnect();
  process.exit(1);
});
