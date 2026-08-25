import { Response } from 'express';
import { AuthRequest } from '../middleware/roleCheck';
import { prisma } from '../lib/prisma';
import { User } from '../models/User';
import { Trip } from '../models/Trip';
import notificationService from '../services/notificationService';

/** Load a verification with its three child tables, in the shape callers read. */
async function loadVerification(client: any, id: string) {
  const row = await client.tripVerification.findUnique({
    where: { id },
    include: {
      documents: true,
      checklist: { orderBy: { itemName: 'asc' } },
      reviewHistory: { orderBy: { timestamp: 'asc' } },
    },
  });
  if (!row) return null;
  return {
    ...row,
    _id: row.id,
    // The arrays kept their original names in the response.
    verificationChecklist: row.checklist,
  };
}

/**
 * Reattach what .populate() used to supply. Trip and User are both still Mongo
 * documents, so this is two queries rather than a join, and the results go back
 * under the keys the admin views already read.
 */
async function attachVerificationRefs(rows: any[]): Promise<any[]> {
  if (rows.length === 0) return [];

  const userIds = Array.from(new Set([
    ...rows.map(r => r.organizerId),
    ...rows.map(r => r.verifiedBy).filter(Boolean),
  ]));
  const tripIds = Array.from(new Set(rows.map(r => r.tripId)));

  const [users, trips] = await Promise.all([
    User.find({ _id: { $in: userIds } }, 'name email phone').lean(),
    Trip.find({ _id: { $in: tripIds } }, 'title destination price').lean(),
  ]);

  const userById = new Map(users.map((u: any) => [u._id.toString(), u]));
  const tripById = new Map(trips.map((t: any) => [t._id.toString(), t]));

  return rows.map(row => ({
    ...row,
    _id: row.id,
    verificationChecklist: row.checklist ?? [],
    tripId: tripById.get(row.tripId) ?? row.tripId,
    organizerId: userById.get(row.organizerId) ?? row.organizerId,
    verifiedBy: row.verifiedBy ? (userById.get(row.verifiedBy) ?? row.verifiedBy) : null,
  }));
}

class VerificationController {
  /**
   * Submit trip for verification
   */
  async submitForVerification(req: AuthRequest, res: Response) {
    try {
      const { tripId, documents, verificationChecklist } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      // documents, verificationChecklist and reviewHistory were three arrays on
      // one document, rewritten whole on every save. They are three tables, and
      // the whole submission is one transaction - a resubmission that replaced
      // the documents but failed before the checklist would otherwise leave the
      // two describing different submissions.
      //
      // reviewHistory is appended to, never replaced: it is the audit trail of
      // what happened to this verification, and a resubmission is another entry
      // rather than a fresh start.
      const userId = req.user.id;
      const verification = await prisma.$transaction(async (tx) => {
        const existing = await tx.tripVerification.findUnique({ where: { tripId } });

        const row = existing
          ? await tx.tripVerification.update({
              where: { id: existing.id },
              data: { status: 'pending', submittedAt: new Date() },
            })
          : await tx.tripVerification.create({
              data: { tripId, organizerId: userId, status: 'pending' },
            });

        if (existing) {
          await tx.tripVerificationDocument.deleteMany({ where: { verificationId: row.id } });
          await tx.tripVerificationChecklistItem.deleteMany({ where: { verificationId: row.id } });
        }

        for (const doc of documents ?? []) {
          await tx.tripVerificationDocument.create({
            data: {
              verificationId: row.id,
              type: doc.type,
              filename: doc.filename,
              url: doc.url,
              verified: !!doc.verified,
            },
          });
        }

        for (const item of verificationChecklist ?? []) {
          await tx.tripVerificationChecklistItem.create({
            data: {
              verificationId: row.id,
              itemName: item.itemName,
              status: item.status ?? 'pending',
              notes: item.notes ?? null,
            },
          });
        }

        await tx.tripVerificationReview.create({
          data: {
            verificationId: row.id,
            reviewedBy: userId,
            action: 'submitted',
            notes: existing ? 'Resubmitted for verification' : null,
          },
        });

        return loadVerification(tx, row.id);
      });

      // Notify admin
      // TODO: Get admin IDs and notify them

      res.status(201).json({
        success: true,
        message: 'Trip submitted for verification',
        data: verification,
      });
    } catch (error: any) {
      console.error('Submit verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to submit trip for verification',
        error: error.message,
      });
    }
  }

  /**
   * Get all verifications (Admin/Organizer)
   */
  async getVerifications(req: AuthRequest, res: Response) {
    try {
      const { status, priority, page = 1, limit = 20 } = req.query;
      const query: any = {};

      // Filter by role
      if (req.user?.role === 'organizer') {
        query.organizerId = req.user.id;
      }

      if (status) query.status = status;
      if (priority) query.priority = priority;

      // The three populate() calls are gone: Trip and User are both still Mongo
      // documents until waves 8 and 9 land them, so they are fetched separately
      // and attached under the same keys.
      const [rows, total] = await Promise.all([
        prisma.tripVerification.findMany({
          where: query,
          orderBy: { submittedAt: 'desc' },
          take: Number(limit),
          skip: (Number(page) - 1) * Number(limit),
          include: { documents: true, checklist: true, reviewHistory: true },
        }),
        prisma.tripVerification.count({ where: query }),
      ]);

      const verifications = await attachVerificationRefs(rows);

      res.json({
        success: true,
        data: verifications,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      });
    } catch (error: any) {
      console.error('Get verifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch verifications',
        error: error.message,
      });
    }
  }

  /**
   * Get verification by trip ID
   */
  async getVerificationByTripId(req: AuthRequest, res: Response) {
    try {
      const { tripId } = req.params;

      const row = await prisma.tripVerification.findUnique({
        where: { tripId },
        include: {
          documents: true,
          checklist: { orderBy: { itemName: 'asc' } },
          reviewHistory: { orderBy: { timestamp: 'asc' } },
        },
      });

      const [verification] = row ? await attachVerificationRefs([row]) : [null];

      if (!verification) {
        return res.status(404).json({
          success: false,
          message: 'Verification record not found',
        });
      }

      res.json({
        success: true,
        data: verification,
      });
    } catch (error: any) {
      console.error('Get verification error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch verification',
        error: error.message,
      });
    }
  }

  /**
   * Update verification status (Admin only)
   */
  async updateVerificationStatus(req: AuthRequest, res: Response) {
    try {
      const { tripId } = req.params;
      const { status, reason, notes } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const existing = await prisma.tripVerification.findUnique({ where: { tripId } });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Verification record not found',
        });
      }

      const reviewerId = req.user.id;
      const data: any = { status };

      if (status === 'verified') {
        data.verifiedBy = reviewerId;
        data.verifiedAt = new Date();
      } else if (status === 'rejected') {
        data.rejectionReason = reason;
      } else if (status === 'revision_required') {
        data.revisionNotes = notes;
      }

      // The status change and its audit entry go together. `status` comes
      // straight from the request body and is an enum, so a value outside the
      // five is refused rather than stored - Mongoose validated it too, but
      // only on save, and this route never checked before assigning.
      const verification = await prisma.$transaction(async (tx) => {
        await tx.tripVerification.update({ where: { id: existing.id }, data });
        await tx.tripVerificationReview.create({
          data: {
            verificationId: existing.id,
            reviewedBy: reviewerId,
            action: status,
            reason: reason ?? null,
            notes: notes ?? null,
          },
        });
        return loadVerification(tx, existing.id);
      });

      // Notify organizer
      await notificationService.createNotification({
        userId: verification.organizerId,
        type: 'verification',
        title: `Trip Verification ${status}`,
        message: `Your trip has been ${status}`,
        actionUrl: `/trips/${tripId}/verification`,
        actionType: 'verify_trip',
        relatedTo: { type: 'trip', id: tripId as any },
        sendEmail: true,
      });

      res.json({
        success: true,
        message: 'Verification status updated',
        data: verification,
      });
    } catch (error: any) {
      console.error('Update verification status error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update verification status',
        error: error.message,
      });
    }
  }

  /**
   * Update checklist item (Admin only)
   */
  async updateChecklistItem(req: AuthRequest, res: Response) {
    try {
      const { tripId } = req.params;
      const { itemId, itemName, itemIndex, status, notes } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const existing = await prisma.tripVerification.findUnique({
        where: { tripId },
        include: { checklist: { orderBy: { itemName: 'asc' } } },
      });

      if (!existing) {
        return res.status(404).json({
          success: false,
          message: 'Verification record not found',
        });
      }

      // The item was addressed by its position in an array, which is only
      // stable while nothing reorders it - and the array was rewritten whole on
      // every resubmission. An id or a name identifies the same item whatever
      // happens to the order. itemIndex still works, against a deterministic
      // ordering, because it was the only thing this route accepted; nothing in
      // the frontend calls it, so it is kept for anyone scripting against it.
      const item =
        (itemId && existing.checklist.find(c => c.id === itemId)) ||
        (itemName && existing.checklist.find(c => c.itemName === itemName)) ||
        (typeof itemIndex === 'number' ? existing.checklist[itemIndex] : undefined);

      if (!item) {
        return res.status(400).json({
          success: false,
          message: 'Checklist item not found',
        });
      }

      await prisma.tripVerificationChecklistItem.update({
        where: { id: item.id },
        data: {
          status,
          notes: notes ?? null,
          checkedBy: req.user.id,
          checkedAt: new Date(),
        },
      });

      const verification = await loadVerification(prisma, existing.id);

      res.json({
        success: true,
        message: 'Checklist item updated',
        data: verification,
      });
    } catch (error: any) {
      console.error('Update checklist item error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update checklist item',
        error: error.message,
      });
    }
  }
}

export default new VerificationController();
