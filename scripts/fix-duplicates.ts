
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { VerificationRequest } from '../services/api/src/models/VerificationRequest';
import { User } from '../services/api/src/models/User';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../services/api/.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/trektribe';

async function fixDuplicates() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        // reliable way to find duplicates: aggregate by organizerId
        const duplicates = await VerificationRequest.aggregate([
            {
                $group: {
                    _id: '$organizerId',
                    count: { $sum: 1 },
                    ids: { $push: '$_id' },
                    statuses: { $push: '$status' }
                }
            },
            {
                $match: {
                    count: { $gt: 1 }
                }
            }
        ]);

        console.log(`Found ${duplicates.length} organizers with duplicate requests.`);

        for (const dup of duplicates) {
            const organizerId = dup._id;
            const requests = await VerificationRequest.find({ organizerId }).sort({ createdAt: -1 });

            console.log(`\nProcessing organizer ${organizerId}: Found ${requests.length} requests`);

            // prioritization: Approved > Rejected > Pending > Initial
            // If multiple of same priority, keep newest.

            let bestRequest = null;
            const requestsToDelete = [];

            // Find the "best" request to keep
            const approved = requests.find(r => r.status === 'approved');
            const rejected = requests.find(r => r.status === 'rejected');
            const pending = requests.find(r => r.status === 'pending');

            if (approved) {
                bestRequest = approved;
                console.log(`  Keeping APPROVED request ${approved._id}`);
            } else if (rejected) {
                bestRequest = rejected;
                console.log(`  Keeping REJECTED request ${rejected._id}`);
            } else if (pending) {
                bestRequest = pending;
                console.log(`  Keeping PENDING request ${pending._id}`);
            } else {
                bestRequest = requests[0]; // Keep newest if all else equal
                console.log(`  Keeping NEWEST request ${bestRequest._id} (Status: ${bestRequest.status})`);
            }

            // Mark others for deletion
            for (const req of requests) {
                if (req._id.toString() !== bestRequest._id.toString()) {
                    requestsToDelete.push(req._id);
                }
            }

            if (requestsToDelete.length > 0) {
                console.log(`  Deleting ${requestsToDelete.length} duplicate requests: ${requestsToDelete.join(', ')}`);
                await VerificationRequest.deleteMany({ _id: { $in: requestsToDelete } });
            }
        }

        console.log('\nCleanup complete!');

        // Optional: Sync User status with surviving VerificationRequest
        // (This is a safety step to ensure consistency)
        console.log('\nVerifying User status consistency...');
        // Fetch all requests again to sync
        const allRequests = await VerificationRequest.find({});
        for (const req of allRequests) {
            const user = await User.findById(req.organizerId);
            if (user && user.organizerVerificationStatus !== req.status) {
                console.log(`  Fixing mismatch for User ${user._id}: User=${user.organizerVerificationStatus}, Request=${req.status}`);
                user.organizerVerificationStatus = req.status;
                if (req.status === 'approved') {
                    user.organizerVerificationApprovedAt = req.reviewedAt || new Date();
                    user.isVerified = true;
                } else if (req.status === 'rejected') {
                    user.organizerVerificationRejectedAt = req.reviewedAt || new Date();
                    user.organizerVerificationRejectionReason = req.rejectionReason;
                }
                await user.save();
            }
        }

    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await mongoose.disconnect();
        console.log('Disconnected from MongoDB');
    }
}

fixDuplicates();
