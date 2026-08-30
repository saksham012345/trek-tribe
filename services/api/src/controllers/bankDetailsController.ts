import { Response } from 'express';
import { AuthRequest } from '../middleware/roleCheck';
import { UserPrisma as User } from '../models/userPrismaAdapter';
import { prisma } from '../lib/prisma';
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

            // Bank details live in organizer_payout_configs, not on the user.
            //
            // This used to assign user.organizerProfile.bankDetails and call
            // save(). The adapter has no mapping for that nested path, so it was
            // dropped without an error: the request answered 200, the form showed
            // the details back, and a reload showed "No bank details added yet".
            // Nothing was ever stored. The schema has said so in a comment for a
            // while; this is that move.
            const user = await User.findById(req.user.id);

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found',
                });
            }

            await prisma.organizerPayoutConfig.upsert({
                where: { organizerId: req.user.id },
                create: {
                    organizerId: req.user.id,
                    accountHolderName,
                    accountNumberEncrypted: encryptedAccountNumber,
                    ifscCode: ifscCode.toUpperCase(),
                    bankName,
                    upiId: upiId || null,
                },
                update: {
                    accountHolderName,
                    accountNumberEncrypted: encryptedAccountNumber,
                    ifscCode: ifscCode.toUpperCase(),
                    bankName,
                    upiId: upiId || null,
                },
            });

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

            const config = await prisma.organizerPayoutConfig.findUnique({
                where: { organizerId: userId },
            });

            if (!config) {
                return res.status(404).json({
                    success: false,
                    message: 'Bank details not found',
                });
            }

            const bankDetails = {
                accountHolderName: config.accountHolderName,
                accountNumber: config.accountNumberEncrypted,
                ifscCode: config.ifscCode,
                bankName: config.bankName,
                upiId: config.upiId,
            };

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

            const config = await prisma.organizerPayoutConfig.findUnique({
                where: { organizerId },
            });

            if (!config) {
                return res.status(404).json({
                    success: false,
                    message: 'Bank details not found',
                });
            }

            const bankDetails = {
                accountHolderName: config.accountHolderName,
                accountNumber: config.accountNumberEncrypted,
                ifscCode: config.ifscCode,
                bankName: config.bankName,
                upiId: config.upiId,
            };

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

            // deleteMany rather than delete: removing details that were never
            // there should not be a 500, and this endpoint is idempotent.
            await prisma.organizerPayoutConfig.deleteMany({
                where: { organizerId: req.user.id },
            });

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
