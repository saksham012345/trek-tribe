import { prisma } from '../lib/prisma';
import { Prisma } from '@prisma/client';
import { toNumber } from '../lib/money';

/**
 * The Trip response shape, rebuilt from columns and child tables.
 *
 * Trip was one document with six embedded arrays and two nested objects. It is
 * now a row plus five tables, which is the right storage - but the frontend and
 * forty-odd call sites read the old shape, so this is where the two meet.
 *
 * Like src/lib/apiShape.ts, this is a seam with an end date: it comes out when
 * the frontend reads the flat columns directly. Until then a Trip leaves the
 * API looking exactly as it did.
 *
 * What it rebuilds:
 *
 *   location        two Float columns -> { type: 'Point', coordinates: [lng, lat] }
 *   paymentConfig   flat columns      -> the nested object, including gatewayQR
 *   safetyInfo      flat columns      -> the nested object
 *   participants    rows              -> an array of user id strings
 *   pickupPoints    rows of kind      -> two separate arrays
 *   dropOffPoints        "
 *   packages        rows              -> array, with packageKey back under `id`
 *   schedule        rows              -> array ordered by day
 *   livePhotos      rows              -> array ordered by upload time
 *
 * The four constant paymentConfig fields - collectionMode, verificationMode,
 * manualProofRequired, trustLevel - are re-emitted as the constants they always
 * were. They are not columns because a column that can hold one value is a
 * comment that costs storage; callers that read them still find them.
 */

export const tripInclude = {
  schedule: { orderBy: { day: 'asc' } },
  packages: { orderBy: { sortOrder: 'asc' } },
  stops: { orderBy: { sortOrder: 'asc' } },
  livePhotos: { orderBy: { uploadedAt: 'asc' } },
  participants: { orderBy: { joinedAt: 'asc' } }
} satisfies Prisma.TripInclude;

type TripWithChildren = Prisma.TripGetPayload<{ include: typeof tripInclude }>;

/** A trip that may or may not have had its children loaded. */
type MaybeLoaded = Partial<TripWithChildren> & { id: string };

export function shapeTrip(trip: MaybeLoaded): any {
  const stops = trip.stops ?? [];

  return {
    ...trip,
    _id: trip.id,

    price: toNumber((trip as any).price),
    averageRating: toNumber((trip as any).averageRating),

    location:
      trip.longitude !== null && trip.longitude !== undefined && trip.latitude !== null && trip.latitude !== undefined
        ? { type: 'Point' as const, coordinates: [trip.longitude, trip.latitude] as [number, number] }
        : undefined,

    // Was `participants: ObjectId[]`. Callers read .length for capacity and
    // .includes for membership - the second of which never worked. The array is
    // still here for the first; membership goes through
    // tripParticipationService.isParticipant.
    participants: (trip.participants ?? []).map(p => p.userId),

    participantCount: (trip.participants ?? []).length,

    schedule: (trip.schedule ?? []).map(day => ({
      day: day.day,
      title: day.title,
      activities: day.activities
    })),

    packages: (trip.packages ?? []).map(pkg => ({
      id: pkg.packageKey,
      name: pkg.name,
      description: pkg.description,
      price: toNumber(pkg.price),
      capacity: pkg.capacity,
      inclusions: pkg.inclusions,
      exclusions: pkg.exclusions,
      isActive: pkg.isActive,
      sortOrder: pkg.sortOrder
    })),

    pickupPoints: stops.filter(s => s.kind === 'pickup').map(shapeStop),
    dropOffPoints: stops.filter(s => s.kind === 'dropoff').map(shapeStop),

    livePhotos: (trip.livePhotos ?? []).map(photo => ({
      url: photo.url,
      filename: photo.filename,
      uploadedAt: photo.uploadedAt,
      caption: photo.caption,
      location: photo.location,
      isThumbnail: photo.isThumbnail
    })),

    paymentConfig: {
      paymentType: (trip as any).paymentType,
      advanceAmount: (trip as any).advanceAmount != null ? toNumber((trip as any).advanceAmount) : undefined,
      dueDate: (trip as any).paymentDueDate ?? undefined,
      refundPolicy: (trip as any).refundPolicy ?? undefined,
      paymentMethods: (trip as any).paymentMethods ?? [],
      instructions: (trip as any).paymentInstructions ?? undefined,
      // Constants, not columns. TrekTribe holds the funds, so these could only
      // ever take one value - which is what the model comments said.
      collectionMode: 'razorpay' as const,
      verificationMode: 'automated' as const,
      manualProofRequired: false as const,
      trustLevel: 'trusted' as const,
      gatewayQR: (trip as any).gatewayQrUrl
        ? {
            provider: 'razorpay' as const,
            amount: toNumber((trip as any).gatewayQrAmount),
            currency: (trip as any).gatewayQrCurrency,
            referenceId: (trip as any).gatewayQrReferenceId,
            qrCodeUrl: (trip as any).gatewayQrUrl,
            generatedAt: (trip as any).gatewayQrGeneratedAt,
            trusted: true
          }
        : undefined
    },

    safetyInfo: {
      hasInsurance: (trip as any).hasInsurance,
      insuranceDetails: (trip as any).insuranceDetails ?? undefined,
      emergencyContactName: (trip as any).emergencyContactName ?? undefined,
      emergencyContactPhone: (trip as any).emergencyContactPhone ?? undefined,
      medicalFacilitiesNearby: (trip as any).medicalFacilitiesNearby ?? undefined,
      safetyEquipment: (trip as any).safetyEquipment ?? [],
      covidProtocol: (trip as any).covidProtocol ?? undefined
    }
  };
}

function shapeStop(stop: any) {
  return {
    name: stop.name,
    address: stop.address,
    coordinates:
      stop.longitude !== null && stop.latitude !== null ? [stop.longitude, stop.latitude] : undefined,
    time: stop.time ?? undefined,
    contactPerson: stop.contactPerson ?? undefined,
    contactPhone: stop.contactPhone ?? undefined,
    landmarks: stop.landmarks ?? undefined,
    instructions: stop.instructions ?? undefined
  };
}

export function shapeTrips(trips: MaybeLoaded[]): any[] {
  return trips.map(shapeTrip);
}

/**
 * Split an incoming trip body into the row and its children.
 *
 * The reverse of shapeTrip: routes accept the nested shape, and this is what
 * turns it into columns and child rows. Returned rather than written so the
 * caller can do the whole thing in one transaction - a trip whose packages were
 * saved and whose schedule was not is worse than a trip that failed to save.
 */
export function splitTripInput(body: any) {
  const paymentConfig = body.paymentConfig ?? {};
  const safetyInfo = body.safetyInfo ?? {};
  const qr = paymentConfig.gatewayQR ?? {};
  const coordinates = body.location?.coordinates;

  const row: any = {
    title: body.title,
    description: body.description,
    difficulty: body.difficulty,
    categories: body.categories ?? [],
    destination: body.destination,
    longitude: coordinates ? coordinates[0] : undefined,
    latitude: coordinates ? coordinates[1] : undefined,
    images: body.images ?? [],
    coverImage: body.coverImage,
    itinerary: body.itinerary,
    itineraryPdf: body.itineraryPdf,
    itineraryPdfFilename: body.itineraryPdfFilename,
    itineraryPdfUploadedAt: body.itineraryPdfUploadedAt,
    capacity: body.capacity,
    price: body.price,
    minimumAge: body.minimumAge,
    startDate: body.startDate ? new Date(body.startDate) : undefined,
    endDate: body.endDate ? new Date(body.endDate) : undefined,
    status: body.status,
    thumbnail: body.thumbnail,
    verificationStatus: body.verificationStatus,
    adminNotes: body.adminNotes,
    safetyDisclaimer: body.safetyDisclaimer,
    contentHash: body.contentHash,
    isDuplicate: body.isDuplicate,
    originalTripId: body.originalTripId,
    isPrivate: body.isPrivate,
    allowedUserIds: body.allowedUserIds?.map(String),
    slug: body.slug,

    paymentType: paymentConfig.paymentType,
    advanceAmount: paymentConfig.advanceAmount,
    paymentDueDate: paymentConfig.dueDate,
    refundPolicy: paymentConfig.refundPolicy,
    paymentMethods: paymentConfig.paymentMethods,
    paymentInstructions: paymentConfig.instructions,
    gatewayQrAmount: qr.amount,
    gatewayQrCurrency: qr.currency,
    gatewayQrReferenceId: qr.referenceId,
    gatewayQrUrl: qr.qrCodeUrl,
    gatewayQrGeneratedAt: qr.generatedAt,

    hasInsurance: safetyInfo.hasInsurance,
    insuranceDetails: safetyInfo.insuranceDetails,
    emergencyContactName: safetyInfo.emergencyContactName,
    emergencyContactPhone: safetyInfo.emergencyContactPhone,
    medicalFacilitiesNearby: safetyInfo.medicalFacilitiesNearby,
    safetyEquipment: safetyInfo.safetyEquipment,
    covidProtocol: safetyInfo.covidProtocol
  };

  for (const key of Object.keys(row)) {
    if (row[key] === undefined) delete row[key];
  }

  return {
    row,
    schedule: (body.schedule ?? []).map((day: any) => ({
      day: day.day,
      title: day.title,
      activities: day.activities ?? []
    })),
    packages: (body.packages ?? []).map((pkg: any, index: number) => ({
      // The application generated this id and nothing enforced it; it is unique
      // per trip now, because bookings reference the package by it.
      packageKey: pkg.id ?? `package-${index + 1}`,
      name: pkg.name,
      description: pkg.description,
      price: pkg.price,
      capacity: pkg.capacity,
      inclusions: pkg.inclusions ?? [],
      exclusions: pkg.exclusions ?? [],
      isActive: pkg.isActive ?? true,
      sortOrder: pkg.sortOrder ?? index
    })),
    stops: [
      ...(body.pickupPoints ?? []).map((s: any, i: number) => stopInput(s, 'pickup', i)),
      ...(body.dropOffPoints ?? []).map((s: any, i: number) => stopInput(s, 'dropoff', i))
    ],
    livePhotos: (body.livePhotos ?? []).map((photo: any) => ({
      url: photo.url,
      filename: photo.filename,
      caption: photo.caption,
      location: photo.location,
      isThumbnail: !!photo.isThumbnail
    }))
  };
}

function stopInput(stop: any, kind: 'pickup' | 'dropoff', index: number) {
  return {
    kind,
    name: stop.name,
    address: stop.address,
    longitude: stop.coordinates?.[0],
    latitude: stop.coordinates?.[1],
    time: stop.time,
    contactPerson: stop.contactPerson,
    contactPhone: stop.contactPhone,
    landmarks: stop.landmarks,
    instructions: stop.instructions,
    sortOrder: index
  };
}

/**
 * Write a trip and its children together.
 *
 * One transaction, because the alternative is a trip that exists with half its
 * itinerary - and the previous code, saving one document, could not produce
 * that state. Moving to tables must not make the failure modes worse.
 */
export async function createTripWithChildren(organizerId: string, body: any) {
  const parts = splitTripInput(body);

  return prisma.$transaction(async (tx) => {
    const trip = await tx.trip.create({
      data: { ...parts.row, organizerId }
    });

    await writeChildren(tx, trip.id, parts);

    return tx.trip.findUnique({ where: { id: trip.id }, include: tripInclude });
  });
}

export async function updateTripWithChildren(tripId: string, body: any) {
  const parts = splitTripInput(body);
  const touchesChildren =
    body.schedule !== undefined ||
    body.packages !== undefined ||
    body.pickupPoints !== undefined ||
    body.dropOffPoints !== undefined ||
    body.livePhotos !== undefined;

  return prisma.$transaction(async (tx) => {
    await tx.trip.update({ where: { id: tripId }, data: parts.row });

    // Only replace the children the caller actually sent. A PATCH that changes
    // the title should not delete the itinerary, which is what replacing them
    // unconditionally would do.
    if (touchesChildren) {
      if (body.schedule !== undefined) {
        await tx.tripScheduleDay.deleteMany({ where: { tripId } });
      }
      if (body.packages !== undefined) {
        await tx.tripPackage.deleteMany({ where: { tripId } });
      }
      if (body.pickupPoints !== undefined || body.dropOffPoints !== undefined) {
        await tx.tripStop.deleteMany({ where: { tripId } });
      }
      if (body.livePhotos !== undefined) {
        await tx.tripLivePhoto.deleteMany({ where: { tripId } });
      }
      await writeChildren(tx, tripId, parts, body);
    }

    return tx.trip.findUnique({ where: { id: tripId }, include: tripInclude });
  });
}

async function writeChildren(tx: any, tripId: string, parts: any, body?: any) {
  const send = (key: string) => body === undefined || body[key] !== undefined;

  if (parts.schedule.length && send('schedule')) {
    await tx.tripScheduleDay.createMany({
      data: parts.schedule.map((d: any) => ({ ...d, tripId }))
    });
  }
  if (parts.packages.length && send('packages')) {
    await tx.tripPackage.createMany({
      data: parts.packages.map((p: any) => ({ ...p, tripId }))
    });
  }
  if (parts.stops.length && (send('pickupPoints') || send('dropOffPoints'))) {
    await tx.tripStop.createMany({
      data: parts.stops.map((s: any) => ({ ...s, tripId }))
    });
  }
  if (parts.livePhotos.length && send('livePhotos')) {
    await tx.tripLivePhoto.createMany({
      data: parts.livePhotos.map((p: any) => ({ ...p, tripId }))
    });
  }
}
