import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { toNumber } from '../lib/money';
import { UserPrisma as User } from '../models/userPrismaAdapter';

/**
 * The GroupBooking response shape, rebuilt from columns and rows.
 *
 * Same job as tripShapeService: the storage is right and the callers read the
 * old shape. Three nested objects and one array come back here -
 * paymentDetails, paymentScreenshot, reminders and participants - along with
 * `_id` and amounts as numbers rather than Decimals.
 *
 * totalParticipants is derived. It was a second column beside numberOfGuests,
 * with the model comment "same as totalParticipants but clearer naming" and a
 * pre-save hook setting each from the other. One number, two names, and the
 * money was computed from whichever happened to be set.
 */

export const bookingInclude = {
  participants: true,
  trip: true
} satisfies Prisma.GroupBookingInclude;

export function shapeBooking(row: any): any {
  if (!row) return row;

  return {
    ...row,
    _id: row.id,

    totalAmount: toNumber(row.totalAmount),
    pricePerPerson: toNumber(row.pricePerPerson),
    groupDiscount: toNumber(row.groupDiscount),
    discountAmount: toNumber(row.discountAmount),
    finalAmount: toNumber(row.finalAmount),
    paidAmount: row.paidAmount != null ? toNumber(row.paidAmount) : undefined,
    advanceAmount: row.advanceAmount != null ? toNumber(row.advanceAmount) : undefined,
    remainingAmount: row.remainingAmount != null ? toNumber(row.remainingAmount) : undefined,
    refundAmount: row.refundAmount != null ? toNumber(row.refundAmount) : undefined,

    // One quantity, one column. Callers that read totalParticipants get the
    // same number they always did.
    totalParticipants: row.numberOfGuests,

    participants: (row.participants ?? []).map((p: any) => ({
      name: p.name,
      email: p.email,
      phone: p.phone,
      dateOfBirth: p.dateOfBirth ?? undefined,
      // The stored value keeps its hyphen; the Prisma member cannot have one.
      gender: p.gender === 'prefer_not_to_say' ? 'prefer-not-to-say' : p.gender ?? undefined,
      emergencyContactName: p.emergencyContactName,
      emergencyContactPhone: p.emergencyContactPhone,
      medicalConditions: p.medicalConditions ?? undefined,
      dietaryRestrictions: p.dietaryRestrictions ?? undefined,
      experienceLevel: p.experienceLevel,
      specialRequests: p.specialRequests ?? undefined,
      isMainBooker: p.isMainBooker
    })),

    // Was the `mainBooker` virtual.
    mainBooker: (row.participants ?? []).find((p: any) => p.isMainBooker),

    paymentDetails: row.transactionDate || row.paymentGateway || row.gatewayTransactionId || row.paymentReference
      ? {
          transactionDate: row.transactionDate ?? undefined,
          paymentGateway: row.paymentGateway ?? undefined,
          gatewayTransactionId: row.gatewayTransactionId ?? undefined,
          paymentReference: row.paymentReference ?? undefined
        }
      : undefined,

    paymentScreenshot: row.screenshotUrl
      ? {
          filename: row.screenshotFilename,
          originalName: row.screenshotOriginalName,
          url: row.screenshotUrl,
          uploadedAt: row.screenshotUploadedAt
        }
      : undefined,

    reminders: row.tripStart24hSentAt ? { tripStart24hSentAt: row.tripStart24hSentAt } : undefined
  };
}

export function shapeBookings(rows: any[]): any[] {
  return rows.map(shapeBooking);
}

/**
 * Group discount by party size. Was a Mongoose static on the model, which is
 * not a place Prisma has, and is a pure function anyway.
 */
export function calculateGroupDiscount(participantCount: number): number {
  if (participantCount >= 15) return 20;
  if (participantCount >= 10) return 15;
  if (participantCount >= 6) return 10;
  if (participantCount >= 4) return 5;
  return 0;
}

/**
 * The amounts a booking is made of, computed once so they add up.
 *
 * The pre-save hook recomputed these on every save, which meant they were
 * right after a save and unchecked at every other moment - and updateOne does
 * not fire it at all. The CHECK constraints on group_bookings now refuse a row
 * whose parts disagree, so this is the one place that decides them.
 */
export function computeBookingAmounts(input: {
  pricePerPerson: number;
  numberOfGuests: number;
  groupDiscount?: number;
  advanceAmount?: number;
}) {
  const groupDiscount = input.groupDiscount ?? 0;
  const totalAmount = round2(input.pricePerPerson * input.numberOfGuests);
  const discountAmount = round2((totalAmount * groupDiscount) / 100);
  const finalAmount = round2(totalAmount - discountAmount);
  const remainingAmount =
    input.advanceAmount != null ? round2(finalAmount - input.advanceAmount) : 0;

  return { totalAmount, discountAmount, finalAmount, groupDiscount, remainingAmount };
}

/** Two decimal places, matching Decimal(14,2) and the CHECK that compares them. */
function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Attach the organizer that .populate({ path: 'tripId', populate: 'organizerId' })
 * used to supply. Trip is a join now; the organizer is still a Mongo document.
 */
export async function attachBookingOrganizers(bookings: any[]): Promise<Map<string, any>> {
  const organizerIds = Array.from(
    new Set(bookings.map(b => b.trip?.organizerId).filter(Boolean))
  );
  if (organizerIds.length === 0) return new Map();

  const users = await User.find({ _id: { $in: organizerIds } }, 'name phone email').lean();
  return new Map<string, any>(users.map((u: any) => [u._id.toString(), u]));
}

/** A booking with its trip and participants, in the old shape. */
export async function findBooking(id: string) {
  const row = await prisma.groupBooking.findUnique({ where: { id }, include: bookingInclude });
  return row ? shapeBooking(row) : null;
}
