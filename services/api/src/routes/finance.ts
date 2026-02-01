import express from 'express';
import { Trip } from '../models/Trip';
import { Expense } from '../models/Expense';
import { GroupBooking } from '../models/GroupBooking'; // Used for Revenue calculation
import { authenticateJwt } from '../middleware/auth';
import { logger } from '../utils/logger';
import mongoose from 'mongoose';

const router = express.Router();

// Middleware: Ensure user is an organizer
const requireOrganizer = (req: any, res: any, next: any) => {
    if (req.auth.role !== 'organizer') {
        return res.status(403).json({ error: 'Access denied. Organizers only.' });
    }
    next();
};

router.use(authenticateJwt);
router.use(requireOrganizer);

// -----------------------------------------------------------------------------
// 1. Finance Overview (Aggregated Stats)
// -----------------------------------------------------------------------------
router.get('/overview', async (req, res) => {
    try {
        const organizerId = (req as any).auth.userId;
        const { period } = req.query; // 'all', 'month', 'year' (default 'all')

        // Date filter helper
        const getDateFilter = (p: any) => {
            const now = new Date();
            if (p === 'month') {
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                return { $gte: startOfMonth };
            }
            if (p === 'year') {
                const startOfYear = new Date(now.getFullYear(), 0, 1);
                return { $gte: startOfYear };
            }
            return null;
        };

        const dateFilter = getDateFilter(period);

        // 1. Calculate Total Revenue from GroupBookings
        const revenueMatch: any = {
            'trip.organizerId': new mongoose.Types.ObjectId(organizerId),
            paymentStatus: { $in: ['completed', 'partial'] } // Only count real money
        };

        // Apply date filter to revenue (using createdAt as proxy for booking time)
        if (dateFilter) {
            revenueMatch['createdAt'] = dateFilter;
        }

        const revenueAgg = await GroupBooking.aggregate([
            // Lookup Trip to filter by organizer
            {
                $lookup: {
                    from: 'trips',
                    localField: 'tripId',
                    foreignField: '_id',
                    as: 'trip'
                }
            },
            { $unwind: '$trip' },
            { $match: revenueMatch },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$paidAmount' }, // Use actual paid amount
                    totalDiscounts: { $sum: '$discountAmount' } // Track discounts given
                }
            }
        ]);

        const totalRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;
        const totalDiscounts = revenueAgg.length > 0 ? revenueAgg[0].totalDiscounts : 0;

        // 2. Calculate Total Expenses
        const expenseMatch: any = {
            organizerId: new mongoose.Types.ObjectId(organizerId)
        };

        if (dateFilter) {
            expenseMatch['date'] = dateFilter;
        }

        const expenseAgg = await Expense.aggregate([
            { $match: expenseMatch },
            {
                $group: {
                    _id: null, // Total for all time
                    totalExpenses: { $sum: '$amount' }
                }
            }
        ]);

        const totalExpenses = expenseAgg.length > 0 ? expenseAgg[0].totalExpenses : 0;
        const netProfit = totalRevenue - totalExpenses;
        const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(2) : 0;

        // 3. TODO: Graph Data (Revenue/Expense per month) - Implementing basic version for now
        // This would require a separate aggregation grouping by month

        res.json({
            summary: {
                revenue: totalRevenue,
                expenses: totalExpenses,
                netProfit,
                profitMargin: Number(profitMargin),
                totalDiscounts // New field
            },
            // Mock graph data for frontend dev, implement real aggregation next step
            graphData: []
        });

    } catch (error: any) {
        logger.error('Error fetching finance overview', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch finance overview' });
    }
});

// -----------------------------------------------------------------------------
// 2. Trip Finance Details
// -----------------------------------------------------------------------------
router.get('/trips/:tripId', async (req, res) => {
    try {
        const { tripId } = req.params;
        const organizerId = (req as any).auth.userId;

        const trip = await Trip.findOne({ _id: tripId, organizerId });
        if (!trip) return res.status(404).json({ error: 'Trip not found' });

        // 1. Trip Revenue
        const revenueAgg = await GroupBooking.aggregate([
            {
                $match: {
                    tripId: new mongoose.Types.ObjectId(tripId),
                    paymentStatus: { $in: ['completed', 'partial'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$paidAmount' },
                    totalDiscounts: { $sum: '$discountAmount' },
                    participantCount: { $sum: '$numberOfGuests' } // approximate
                }
            }
        ]);

        const tripRevenue = revenueAgg.length > 0 ? revenueAgg[0].totalRevenue : 0;
        const tripDiscounts = revenueAgg.length > 0 ? revenueAgg[0].totalDiscounts : 0;
        const participantCount = revenueAgg.length > 0 ? revenueAgg[0].participantCount : 0;

        // 2. Trip Expenses
        const expenses = await Expense.find({ tripId }).sort({ date: -1 });
        const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

        // 3. Derived Stats
        const netProfit = tripRevenue - totalExpenses;
        const profitPerTraveler = participantCount > 0 ? Math.round(netProfit / participantCount) : 0;

        // 4. Breakdown by Category
        const categoryBreakdown = expenses.reduce((acc: any, exp) => {
            acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
            return acc;
        }, {});

        res.json({
            tripSummary: {
                title: trip.title,
                startDate: trip.startDate,
                status: trip.status
            },
            financials: {
                revenue: tripRevenue,
                expenses: totalExpenses,
                netProfit,
                profitPerTraveler, // Metric requested by user
                discounts: tripDiscounts
            },
            breakdown: categoryBreakdown,
            transactions: expenses
        });

    } catch (error: any) {
        logger.error('Error fetching trip financials', { error: error.message });
        res.status(500).json({ error: 'Failed to fetch trip financials' });
    }
});

// -----------------------------------------------------------------------------
// 3. Expense Management (CRUD)
// -----------------------------------------------------------------------------

// Add Expense
router.post('/expenses', async (req, res) => {
    try {
        const organizerId = (req as any).auth.userId;
        const { tripId, category, amount, description, date } = req.body;

        if (!tripId || !category || !amount) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const expense = new Expense({
            organizerId,
            tripId,
            category,
            amount,
            description,
            date: date || new Date()
        });

        await expense.save();
        logger.info(`Expense added via API`, { id: expense._id, tripId });

        res.status(201).json(expense);
    } catch (error: any) {
        logger.error('Error creating expense', { error: error.message });
        res.status(500).json({ error: 'Failed to create expense' });
    }
});

// Delete Expense
router.delete('/expenses/:id', async (req, res) => {
    try {
        const organizerId = (req as any).auth.userId;
        const { id } = req.params;

        const expense = await Expense.findOneAndDelete({ _id: id, organizerId });
        if (!expense) return res.status(404).json({ error: 'Expense not found' });

        res.json({ message: 'Expense deleted' });
    } catch (error: any) {
        logger.error('Error deleting expense', { error: error.message });
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

export default router;
