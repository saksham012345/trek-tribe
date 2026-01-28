import { Response } from 'express';
import { AuthRequest } from '../middleware/roleCheck';
import { User } from '../models/User';
import {
    encryptBankDetail,
    decryptBankDetail,
    maskAccountNumber,
    validateIFSC,
    validateUPI
} from '../utils/bankDetailsEncryption';

/**
 * Bank Details Controller
 * Handles secure storage and retrieval of organizer bank details
 */

class BankDetailsController {
    /**
     * Add or update bank details for organizer
     */
    async updateBankDetails(req: AuthRequest, res: Response) {
        try {
            if (!req.user || req.user.role !== 'organizer') {
                return res.status(403).json({
                    success: false,
                    message: 'Only organizers can update bank details',
                });
            }

            const {
                accountHolderName,
                accountNumber,
                ifscCode,
                bankName,
                upiId
            } = req.body;

            // Validation
            if (!accountHolderName || !accountNumber || !ifscCode || !bankName) {
                return res.status(400).json({
                    success: false,
                    message: 'Account holder name, account number, IFSC code, and bank name are required',
                });
            }

            // Validate IFSC code format
            if (!validateIFSC(ifscCode.toUpperCase())) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid IFSC code format',
                });
            }

            // Validate UPI ID if provided
            if (upiId && !validateUPI(upiId)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid UPI ID format',
                });
            }

            // Encrypt sensitive data
            const encryptedAccountNumber = encryptBankDetail(accountNumber);

            // Update user's bank details
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                });
            }

            // Initialize organizerProfile if it doesn't exist
            if (!user.organizerProfile) {
                user.organizerProfile = {};
            }

            // Update bank details
            user.organizerProfile.bankDetails = {
                accountHolderName,
                accountNumber: encryptedAccountNumber, // Store encrypted
                ifscCode: ifscCode.toUpperCase(),
                bankName,
                upiId: upiId || undefined,
            };

            await user.save();

            console.log(`✅ Bank details updated for organizer ${req.user.id}`);

            res.json({
                success: true,
                message: 'Bank details updated successfully',
                data: {
                    accountHolderName,
                    accountNumber: maskAccountNumber(accountNumber), // Return masked
                    ifscCode: ifscCode.toUpperCase(),
                    bankName,
                    upiId: upiId || null,
                },
            });
        } catch (error: any) {
            console.error('Update bank details error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update bank details',
                error: error.message,
            });
        }
    }

    /**
     * Get bank details for organizer (masked for security)
     */
    async getBankDetails(req: AuthRequest, res: Response) {
        try {
            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                });
            }

            const userId = req.params.organizerId || req.user.id;

            // Only allow organizers to view their own details, or admins to view any
            if (req.user.role !== 'admin' && userId !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: 'Unauthorized to view these bank details',
                });
            }

            const user = await User.findById(userId);

            if (!user || !user.organizerProfile?.bankDetails) {
                return res.status(404).json({
                    success: false,
                    message: 'Bank details not found',
                });
            }

            const bankDetails = user.organizerProfile.bankDetails;

            // Decrypt account number for display (masked)
            let maskedAccountNumber = '****';
            try {
                const decryptedAccountNumber = decryptBankDetail(bankDetails.accountNumber || '');
                maskedAccountNumber = maskAccountNumber(decryptedAccountNumber);
            } catch (error) {
                console.error('Error decrypting account number:', error);
            }

            res.json({
                success: true,
                data: {
                    accountHolderName: bankDetails.accountHolderName,
                    accountNumber: maskedAccountNumber,
                    ifscCode: bankDetails.ifscCode,
                    bankName: bankDetails.bankName,
                    upiId: bankDetails.upiId || null,
                },
            });
        } catch (error: any) {
            console.error('Get bank details error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch bank details',
                error: error.message,
            });
        }
    }

    /**
     * Get full bank details (admin only, for settlements)
     */
    async getFullBankDetails(req: AuthRequest, res: Response) {
        try {
            if (!req.user || req.user.role !== 'admin') {
                return res.status(403).json({
                    success: false,
                    message: 'Admin access required',
                });
            }

            const { organizerId } = req.params;

            const user = await User.findById(organizerId);

            if (!user || !user.organizerProfile?.bankDetails) {
                return res.status(404).json({
                    success: false,
                    message: 'Bank details not found',
                });
            }

            const bankDetails = user.organizerProfile.bankDetails;

            // Decrypt account number for admin
            const decryptedAccountNumber = decryptBankDetail(bankDetails.accountNumber || '');

            res.json({
                success: true,
                data: {
                    accountHolderName: bankDetails.accountHolderName,
                    accountNumber: decryptedAccountNumber, // Full number for admin
                    ifscCode: bankDetails.ifscCode,
                    bankName: bankDetails.bankName,
                    upiId: bankDetails.upiId || null,
                },
            });
        } catch (error: any) {
            console.error('Get full bank details error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch bank details',
                error: error.message,
            });
        }
    }

    /**
     * Delete bank details
     */
    async deleteBankDetails(req: AuthRequest, res: Response) {
        try {
            if (!req.user || req.user.role !== 'organizer') {
                return res.status(403).json({
                    success: false,
                    message: 'Only organizers can delete bank details',
                });
            }

            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                });
            }

            if (user.organizerProfile) {
                user.organizerProfile.bankDetails = undefined;
                await user.save();
            }

            console.log(`🗑️  Bank details deleted for organizer ${req.user.id}`);

            res.json({
                success: true,
                message: 'Bank details deleted successfully',
            });
        } catch (error: any) {
            console.error('Delete bank details error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to delete bank details',
                error: error.message,
            });
        }
    }
}

export default new BankDetailsController();
