import { Response } from 'express';
import { AuthRequest } from '../middleware/roleCheck';
import TripVerification from '../models/TripVerification';
import notificationService from '../services/notificationService';

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

      // Check if verification already exists
      let verification = await TripVerification.findOne({ tripId });

      if (verification) {
        // Update existing verification
        verification.documents = documents;
        verification.verificationChecklist = verificationChecklist || [];
        verification.status = 'pending';
        verification.submittedAt = new Date();
        verification.reviewHistory.push({
          reviewedBy: req.user.id as any,
          action: 'submitted',
          notes: 'Resubmitted for verification',
          timestamp: new Date(),
        });
      } else {
        // Create new verification
        verification = new TripVerification({
          tripId,
          organizerId: req.user.id,
          documents,
          verificationChecklist: verificationChecklist || [],
          status: 'pending',
          reviewHistory: [
            {
              reviewedBy: req.user.id as any,
              action: 'submitted',
              timestamp: new Date(),
            },
          ],
        });
      }

      await verification.save();

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

      const verifications = await TripVerification.find(query)
        .populate('tripId', 'title destination price')
        .populate('organizerId', 'name email')
        .populate('verifiedBy', 'name email')
        .sort({ submittedAt: -1 })
        .limit(Number(limit))
        .skip((Number(page) - 1) * Number(limit));

      const total = await TripVerification.countDocuments(query);

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

      const verification = await TripVerification.findOne({ tripId })
        .populate('tripId')
        .populate('organizerId', 'name email phone')
        .populate('verifiedBy', 'name email')
        .populate('reviewHistory.reviewedBy', 'name email');

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

      const verification = await TripVerification.findOne({ tripId });

      if (!verification) {
        return res.status(404).json({
          success: false,
          message: 'Verification record not found',
        });
      }

      verification.status = status;

      if (status === 'verified') {
        verification.verifiedBy = req.user.id as any;
        verification.verifiedAt = new Date();
      } else if (status === 'rejected') {
        verification.rejectionReason = reason;
      } else if (status === 'revision_required') {
        verification.revisionNotes = notes;
      }

      verification.reviewHistory.push({
        reviewedBy: req.user.id as any,
        action: status,
        reason,
        notes,
        timestamp: new Date(),
      });

      await verification.save();

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
      const { itemIndex, status, notes } = req.body;

      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required',
        });
      }

      const verification = await TripVerification.findOne({ tripId });

      if (!verification) {
        return res.status(404).json({
          success: false,
          message: 'Verification record not found',
        });
      }

      if (!verification.verificationChecklist[itemIndex]) {
        return res.status(400).json({
          success: false,
          message: 'Invalid checklist item index',
        });
      }

      verification.verificationChecklist[itemIndex].status = status;
      verification.verificationChecklist[itemIndex].notes = notes;
      verification.verificationChecklist[itemIndex].checkedBy = req.user.id as any;
      verification.verificationChecklist[itemIndex].checkedAt = new Date();

      await verification.save();

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
