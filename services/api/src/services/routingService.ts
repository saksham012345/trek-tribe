import { User } from '../models/User';
import { CustomTripRequestDocument } from '../models/CustomTripRequest';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

export class RoutingService {

    /**
     * Find organizers who match the criteria for a custom trip request.
     * Criteria:
     * 1. Role is 'organizer'
     * 2. Trust Score >= 60
     * 3. (Optional Future) Matches destination expertise
     */
    static async findMatchingOrganizers(request: CustomTripRequestDocument): Promise<mongoose.Types.ObjectId[]> {
        try {
            // Threshold from env or default to 60 as per requirements
            const minTrustScore = 60;

            const query: any = {
                role: 'organizer',
                'organizerVerificationStatus': 'approved', // Must be verified platform-side first
                // Trust Score Check
                'organizerProfile.trustScore.overall': { $gte: minTrustScore }
            };

            // Basic availability check: Ensure they have a company name set (proxy for being fully set up)
            query['organizerProfile.businessInfo.companyName'] = { $exists: true, $ne: '' };

            const matchingOrganizers = await User.find(query).select('_id organizerProfile.trustScore');

            logger.info(`Routing logic found ${matchingOrganizers.length} organizers for request ${request._id}`, {
                destination: request.destination,
                minScore: minTrustScore
            });

            return matchingOrganizers.map(org => org._id as mongoose.Types.ObjectId);
        } catch (error: any) {
            logger.error('Error finding matching organizers', { error: error.message });
            return [];
        }
    }

    /**
     * Determine if an organizer is eligible for Auto-Conversion (Trust Score >= 80)
     */
    static async isEligibleForAutoConversion(organizerId: string | mongoose.Types.ObjectId): Promise<boolean> {
        const organizer = await User.findById(organizerId).select('organizerProfile.trustScore');
        if (!organizer || !organizer.organizerProfile?.trustScore?.overall) return false;

        return organizer.organizerProfile.trustScore.overall >= 80;
    }
}
