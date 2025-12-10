import { User } from '../models/User';
import { GroupBooking } from '../models/GroupBooking';
import { logger } from '../utils/logger';
import { emailService } from './emailService';

/**
 * ID Verification Service
 * Handles traveler ID verification (Aadhaar, PAN, Passport, etc.)
 */
class IdVerificationService {
  
  /**
   * Submit ID for verification
   * @param userId - User ID
   * @param idData - ID verification data
   */
  async submitIdVerification(
    userId: string,
    idData: {
      documentType: 'aadhaar' | 'pan' | 'passport' | 'driving_license' | 'voter_id';
      documentNumber: string;
      documentFront: string; // File path or URL
      documentBack?: string; // File path or URL
      expiryDate?: Date;
    }
  ): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      // Validate document number format based on type
      const validationResult = this.validateDocumentNumber(idData.documentType, idData.documentNumber);
      if (!validationResult.valid) {
        return { success: false, message: validationResult.message || 'Invalid document number' };
      }

      // Update user with ID verification data
      await User.findByIdAndUpdate(userId, {
        idVerificationStatus: 'pending',
        idVerification: {
          documentType: idData.documentType,
          documentNumber: idData.documentNumber,
          documentFront: idData.documentFront,
          documentBack: idData.documentBack,
          verified: false,
          expiryDate: idData.expiryDate,
        },
      });

      logger.info('ID verification submitted', { 
        userId, 
        documentType: idData.documentType 
      });

      // Send notification email
      if (emailService.isServiceReady() && user.email) {
        await emailService.sendEmail({
          to: user.email,
          subject: 'ID Verification Submitted - Trek-Tribe',
          html: this.generateSubmissionEmailTemplate(user.name, idData.documentType),
        }).catch(err => logger.error('Failed to send ID verification email', { error: err.message }));
      }

      return {
        success: true,
        message: `${this.getDocumentTypeName(idData.documentType)} verification submitted successfully. We'll review it within 24-48 hours.`,
      };
    } catch (error: any) {
      logger.error('Error submitting ID verification', { error: error.message, userId });
      return { success: false, message: 'Failed to submit ID verification', error: error.message };
    }
  }

  /**
   * Verify traveler ID (admin/organizer action)
   * @param userId - User ID
   * @param verifiedBy - Admin/Organizer ID
   * @param approved - Approval status
   * @param rejectionReason - Reason if rejected
   */
  async verifyTravelerId(
    userId: string,
    verifiedBy: string,
    approved: boolean,
    rejectionReason?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { success: false, message: 'User not found' };
      }

      if (!user.idVerification) {
        return { success: false, message: 'No ID verification data found' };
      }

      const updateData: any = {
        idVerificationStatus: approved ? 'verified' : 'rejected',
        'idVerification.verified': approved,
      };

      if (approved) {
        updateData['idVerification.verifiedAt'] = new Date();
      } else {
        updateData['idVerification.rejectionReason'] = rejectionReason || 'Document not clear or invalid';
      }

      await User.findByIdAndUpdate(userId, updateData);

      logger.info('Traveler ID verification updated', { 
        userId, 
        verifiedBy, 
        approved 
      });

      // Send notification email
      if (emailService.isServiceReady() && user.email) {
        const emailHtml = approved
          ? this.generateApprovalEmailTemplate(user.name, user.idVerification.documentType)
          : this.generateRejectionEmailTemplate(user.name, user.idVerification.documentType, rejectionReason);

        await emailService.sendEmail({
          to: user.email,
          subject: `ID Verification ${approved ? 'Approved' : 'Rejected'} - Trek-Tribe`,
          html: emailHtml,
        }).catch(err => logger.error('Failed to send verification result email', { error: err.message }));
      }

      return {
        success: true,
        message: approved ? 'ID verified successfully' : 'ID verification rejected',
      };
    } catch (error: any) {
      logger.error('Error verifying traveler ID', { error: error.message, userId });
      return { success: false, message: 'Failed to update verification status' };
    }
  }

  /**
   * Check if user can join a trip (ID verification required)
   * @param userId - User ID
   * @param tripId - Trip ID
   */
  async canJoinTrip(userId: string, tripId: string): Promise<{
    canJoin: boolean;
    reason?: string;
    requiresVerification: boolean;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { canJoin: false, reason: 'User not found', requiresVerification: false };
      }

      // Check if ID verification is required for this trip
      // For now, we'll require it for all trips (can be customized per trip)
      const requiresVerification = true;

      if (!requiresVerification) {
        return { canJoin: true, requiresVerification: false };
      }

      if (user.idVerificationStatus !== 'verified') {
        return {
          canJoin: false,
          reason: this.getVerificationRequiredMessage(user.idVerificationStatus),
          requiresVerification: true,
        };
      }

      return { canJoin: true, requiresVerification: true };
    } catch (error: any) {
      logger.error('Error checking join eligibility', { error: error.message, userId, tripId });
      return { canJoin: false, reason: 'Error checking eligibility', requiresVerification: false };
    }
  }

  /**
   * Get verification status for user
   * @param userId - User ID
   */
  async getVerificationStatus(userId: string): Promise<{
    status: 'not_verified' | 'pending' | 'verified' | 'rejected';
    documentType?: string;
    verifiedAt?: Date;
    rejectionReason?: string;
  }> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        return { status: 'not_verified' };
      }

      return {
        status: user.idVerificationStatus || 'not_verified',
        documentType: user.idVerification?.documentType,
        verifiedAt: user.idVerification?.verifiedAt,
        rejectionReason: user.idVerification?.rejectionReason,
      };
    } catch (error: any) {
      logger.error('Error getting verification status', { error: error.message, userId });
      return { status: 'not_verified' };
    }
  }

  /**
   * Validate document number format
   */
  private validateDocumentNumber(
    documentType: string,
    documentNumber: string
  ): { valid: boolean; message?: string } {
    switch (documentType) {
      case 'aadhaar':
        // Aadhaar: 12 digits
        if (!/^\d{12}$/.test(documentNumber)) {
          return { valid: false, message: 'Aadhaar number must be 12 digits' };
        }
        break;
      case 'pan':
        // PAN: 10 alphanumeric (e.g., ABCDE1234F)
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(documentNumber)) {
          return { valid: false, message: 'Invalid PAN format (e.g., ABCDE1234F)' };
        }
        break;
      case 'passport':
        // Passport: 8 alphanumeric
        if (!/^[A-Z][0-9]{7}$/.test(documentNumber)) {
          return { valid: false, message: 'Invalid passport format (e.g., A1234567)' };
        }
        break;
      case 'driving_license':
        // Driving License: Varies by state, basic validation
        if (documentNumber.length < 10 || documentNumber.length > 16) {
          return { valid: false, message: 'Driving license must be 10-16 characters' };
        }
        break;
      case 'voter_id':
        // Voter ID: 10 alphanumeric
        if (!/^[A-Z]{3}[0-9]{7}$/.test(documentNumber)) {
          return { valid: false, message: 'Invalid Voter ID format (e.g., ABC1234567)' };
        }
        break;
      default:
        return { valid: false, message: 'Invalid document type' };
    }

    return { valid: true };
  }

  /**
   * Get user-friendly document type name
   */
  private getDocumentTypeName(documentType: string): string {
    const names: Record<string, string> = {
      aadhaar: 'Aadhaar Card',
      pan: 'PAN Card',
      passport: 'Passport',
      driving_license: 'Driving License',
      voter_id: 'Voter ID',
    };
    return names[documentType] || documentType;
  }

  /**
   * Get verification required message based on status
   */
  private getVerificationRequiredMessage(status?: string): string {
    switch (status) {
      case 'not_verified':
        return 'Please submit your ID for verification to join trips';
      case 'pending':
        return 'Your ID verification is under review. You can join trips once verified (usually within 24-48 hours)';
      case 'rejected':
        return 'Your ID verification was rejected. Please resubmit with correct documents';
      default:
        return 'ID verification required to join this trip';
    }
  }

  /**
   * Generate submission email template
   */
  private generateSubmissionEmailTemplate(userName: string, documentType: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .info-box { background: white; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ ID Verification Submitted</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>We've received your <strong>${this.getDocumentTypeName(documentType)}</strong> for verification.</p>
            <div class="info-box">
              <p><strong>What happens next?</strong></p>
              <ul>
                <li>Our team will review your documents within 24-48 hours</li>
                <li>You'll receive an email once verification is complete</li>
                <li>After approval, you can join any trip on Trek-Tribe</li>
              </ul>
            </div>
            <p>If you have any questions, feel free to reach out to our support team.</p>
            <p>Best regards,<br><strong>Trek-Tribe Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate approval email template
   */
  private generateApprovalEmailTemplate(userName: string, documentType: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .success-box { background: #d1fae5; border-left: 4px solid #10b981; padding: 20px; margin: 20px 0; border-radius: 4px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 ID Verified Successfully!</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <div class="success-box">
              <p><strong>Great news!</strong></p>
              <p>Your <strong>${this.getDocumentTypeName(documentType)}</strong> has been verified successfully. You're now ready to join any trip on Trek-Tribe!</p>
            </div>
            <p>With your ID verified, you can:</p>
            <ul>
              <li>✅ Book any trip instantly</li>
              <li>✅ Join group adventures</li>
              <li>✅ Access exclusive verified traveler benefits</li>
            </ul>
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/trips" class="button">Explore Trips</a>
            </div>
            <p>Happy traveling!</p>
            <p>Best regards,<br><strong>Trek-Tribe Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generate rejection email template
   */
  private generateRejectionEmailTemplate(userName: string, documentType: string, reason?: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
          .warning-box { background: #fee2e2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0; border-radius: 4px; }
          .button { display: inline-block; background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ ID Verification Issue</h1>
          </div>
          <div class="content">
            <p>Hi ${userName},</p>
            <p>We were unable to verify your <strong>${this.getDocumentTypeName(documentType)}</strong>.</p>
            <div class="warning-box">
              <p><strong>Reason:</strong></p>
              <p>${reason || 'Document image is not clear or information could not be verified'}</p>
            </div>
            <p><strong>What to do next:</strong></p>
            <ul>
              <li>Ensure document images are clear and not blurry</li>
              <li>Make sure all details are visible</li>
              <li>Upload recent, high-quality photos</li>
              <li>Resubmit your documents for verification</li>
            </ul>
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL}/profile/verification" class="button">Resubmit ID</a>
            </div>
            <p>If you have questions, contact our support team.</p>
            <p>Best regards,<br><strong>Trek-Tribe Team</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const idVerificationService = new IdVerificationService();
