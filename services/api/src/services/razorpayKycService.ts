import Razorpay from 'razorpay';
import { User } from '../models/User';
import { logger } from '../utils/logger';

/**
 * Razorpay KYC Service
 * Handles KYC verification through Razorpay Route (formerly RazorpayX)
 */
class RazorpayKycService {
  private razorpay: Razorpay | null = null;

  constructor() {
    if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      this.razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
      logger.info('Razorpay KYC service initialized');
    } else {
      logger.warn('Razorpay credentials not found - KYC service unavailable');
    }
  }

  /**
   * Check if service is ready
   */
  isServiceReady(): boolean {
    return this.razorpay !== null;
  }

  /**
   * Create Razorpay account for organizer
   * @param userId - User ID
   * @param accountData - Account creation data
   */
  async createAccount(userId: string, accountData: {
    email: string;
    phone: string;
    legal_business_name: string;
    business_type: 'proprietorship' | 'partnership' | 'private_limited' | 'public_limited' | 'llp';
    contact_name: string;
    profile: {
      category: string;
      subcategory: string;
      addresses: {
        registered: {
          street1: string;
          street2?: string;
          city: string;
          state: string;
          postal_code: string;
          country: string;
        };
      };
    };
  }): Promise<{ accountId: string; success: boolean; error?: string }> {
    try {
      if (!this.isServiceReady()) {
        return { accountId: '', success: false, error: 'Razorpay service not configured' };
      }

      // Note: This is a placeholder for Razorpay Route API
      // Actual implementation requires Razorpay Route (RazorpayX) account
      logger.info('Creating Razorpay account', { userId });

      // Update user with account ID
      const user = await User.findByIdAndUpdate(
        userId,
        {
          razorpayAccountId: `acc_${Date.now()}`, // Placeholder
          kycStatus: 'submitted',
          kycSubmittedAt: new Date(),
        },
        { new: true }
      );

      if (!user) {
        return { accountId: '', success: false, error: 'User not found' };
      }

      logger.info('Razorpay account created', { userId, accountId: user.razorpayAccountId });

      return {
        accountId: user.razorpayAccountId || '',
        success: true,
      };
    } catch (error: any) {
      logger.error('Error creating Razorpay account', { error: error.message, userId });
      return { accountId: '', success: false, error: error.message };
    }
  }

  /**
   * Submit KYC documents to Razorpay
   * @param userId - User ID
   * @param documents - KYC documents
   */
  async submitKycDocuments(userId: string, documents: {
    business_proof_url?: string;
    business_pan_url?: string;
    promoter_address_url?: string;
    business_operation_proof_url?: string;
  }): Promise<{ success: boolean; stakeholderId?: string; error?: string }> {
    try {
      if (!this.isServiceReady()) {
        return { success: false, error: 'Razorpay service not configured' };
      }

      const user = await User.findById(userId);
      if (!user || !user.razorpayAccountId) {
        return { success: false, error: 'Razorpay account not created' };
      }

      logger.info('Submitting KYC documents', { userId, accountId: user.razorpayAccountId });

      // Note: This is a placeholder for Razorpay Route API
      // Actual implementation requires proper API calls
      const stakeholderId = `sth_${Date.now()}`;

      await User.findByIdAndUpdate(userId, {
        razorpayStakeholderId: stakeholderId,
        kycStatus: 'under_review',
      });

      logger.info('KYC documents submitted', { userId, stakeholderId });

      return {
        success: true,
        stakeholderId,
      };
    } catch (error: any) {
      logger.error('Error submitting KYC documents', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Check KYC status from Razorpay
   * @param userId - User ID
   */
  async checkKycStatus(userId: string): Promise<{
    status: 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected';
    message?: string;
  }> {
    try {
      if (!this.isServiceReady()) {
        return { status: 'pending', message: 'Razorpay service not configured' };
      }

      const user = await User.findById(userId);
      if (!user) {
        return { status: 'pending', message: 'User not found' };
      }

      if (!user.razorpayAccountId) {
        return { status: 'pending', message: 'Razorpay account not created' };
      }

      // Note: This is a placeholder
      // In production, fetch actual status from Razorpay API
      return {
        status: user.kycStatus || 'pending',
        message: `KYC status: ${user.kycStatus}`,
      };
    } catch (error: any) {
      logger.error('Error checking KYC status', { error: error.message, userId });
      return { status: 'pending', message: error.message };
    }
  }

  /**
   * Approve KYC (admin action)
   * @param userId - User ID
   */
  async approveKyc(userId: string, adminId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          kycStatus: 'approved',
          kycVerified: true,
          kycApprovedAt: new Date(),
        },
        { new: true }
      );

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      logger.info('KYC approved', { userId, adminId });

      return { success: true };
    } catch (error: any) {
      logger.error('Error approving KYC', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }

  /**
   * Reject KYC (admin action)
   * @param userId - User ID
   * @param reason - Rejection reason
   */
  async rejectKyc(
    userId: string,
    reason: string,
    adminId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          kycStatus: 'rejected',
          kycVerified: false,
          kycRejectionReason: reason,
        },
        { new: true }
      );

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      logger.info('KYC rejected', { userId, adminId, reason });

      return { success: true };
    } catch (error: any) {
      logger.error('Error rejecting KYC', { error: error.message, userId });
      return { success: false, error: error.message };
    }
  }
}

export const razorpayKycService = new RazorpayKycService();
