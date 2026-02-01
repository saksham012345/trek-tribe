import { Proposal, CustomTripRequestDocument } from '../models/CustomTripRequest';
import { logger } from '../utils/logger';

export interface AIAnalysisResult {
    score: number; // 0-100
    riskLevel: 'Low' | 'Medium' | 'High';
    isApproved: boolean; // True if Score > threshold (e.g. 70) and Risk != High
    reasons: string[];
}

export class AIQualityService {

    /**
     * Analyze a proposal against the request and general quality standards.
     * Checks for:
     * - Completeness of Quality Snapshot
     * - Price sanity (dummy logic for now)
     * - Clarity of Value Statement
     */
    static async analyzeTripProposal(proposal: Proposal, request: CustomTripRequestDocument): Promise<AIAnalysisResult> {
        logger.info('Starting AI Quality Analysis for proposal', {
            organizer: proposal.organizerId,
            request: request._id
        });

        // Mock Logic for MVP / Testing
        const reasons: string[] = [];
        let score = 100;
        let riskLevel: 'Low' | 'Medium' | 'High' = 'Low';

        // 1. Check Completeness
        if (!proposal.qualitySnapshot.safetyPlanPresent) {
            score -= 20;
            reasons.push('Safety plan is not marked as present.');
            riskLevel = 'Medium';
        }

        const descLength = proposal.valueStatement.length;
        if (descLength < 50) {
            score -= 10;
            reasons.push('Value statement is too short/vague.');
        }

        // 2. Check Price vs Budget (if budget exists)
        if (request.budget && proposal.price > request.budget * 1.5) {
            score -= 10;
            reasons.push('Price significantly exceeds budget.');
            riskLevel = 'Medium'; // Not high risk, but warning
        }

        // 3. Keyword Check for "Low Effort" (Mock)
        const lowEffortKeywords = ['call me', 'contact for details', 'tbd'];
        const content = (proposal.itinerarySummary + ' ' + proposal.valueStatement).toLowerCase();

        const hasLowEffort = lowEffortKeywords.some(kw => content.includes(kw));
        if (hasLowEffort) {
            score -= 30;
            riskLevel = 'High';
            reasons.push('Proposal contains vague placeholders or solicitation.');
        }

        const isApproved = score >= 70 && riskLevel !== 'High';

        logger.info('AI Analysis Complete', { score, riskLevel, isApproved });

        return {
            score,
            riskLevel,
            isApproved,
            reasons
        };
    }
}
