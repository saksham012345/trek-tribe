import express from 'express';
import { Trip } from '../models/Trip';
import { prisma } from '../lib/prisma';
import { toNumber } from '../lib/money';
import { withMongoIds } from '../lib/apiShape';
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
        const expenseWhere: any = { organizerId };

        // dateFilter is a Mongo range ({ $gte, $lte }); Prisma spells the same
        // range { gte, lte }.
        if (dateFilter) {
            // getDateFilter only ever returns a { $gte } lower bound.
            expenseWhere.date = { gte: dateFilter.$gte };
        }

        const expenseAgg = await prisma.expense.aggregate({
            where: expenseWhere,
            _sum: { amount: true }
        });

        // _sum.amount is a Decimal, and it is null when nothing matched. The
        // subtraction below is against a plain number, so it converts here -
        // Decimal minus number would not have thrown, it would have produced a
        // Decimal that JSON-encodes as a string.
        const totalExpenses = toNumber(expenseAgg._sum.amount);
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
        const expenseRows = await prisma.expense.findMany({
            where: { tripId },
            orderBy: { date: 'desc' }
        });
        // amount is Decimal now, so every one of these is converted before it is
        // added to anything. `sum + exp.amount` with a Decimal on the right is a
        // string concatenation that yields "0149913200" rather than a total.
        const expenses = expenseRows.map(exp => ({ ...exp, amount: toNumber(exp.amount) }));
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
            // The table keys rows on _id and calls amount.toLocaleString().
            transactions: withMongoIds(expenses)
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

        const expense = await prisma.expense.create({
            data: {
                organizerId,
                tripId,
                category,
                amount,
                description,
                date: date ? new Date(date) : new Date()
            }
        });

        logger.info(`Expense added via API`, { id: expense.id, tripId });

        res.status(201).json({ ...expense, _id: expense.id, amount: toNumber(expense.amount) });
    } catch (error: any) {
        // A category outside the eight the enum allows, or a negative amount,
        // is refused by the database rather than stored. Mongoose validated the
        // category and ignored the sign.
        if (error?.code === 'P2000' || error?.code === 'P2003' || /invalid input value for enum|violates check constraint/i.test(error?.message || '')) {
            return res.status(400).json({ error: 'Invalid expense category or amount' });
        }
        logger.error('Error creating expense', { error: error.message });
        res.status(500).json({ error: 'Failed to create expense' });
    }
});

// Delete Expense
router.delete('/expenses/:id', async (req, res) => {
    try {
        const organizerId = (req as any).auth.userId;
        const { id } = req.params;

        // Scoped to the organizer, as before, so deleteMany deletes at most one
        // and one belonging to someone else is not found rather than deleted.
        //
        // No id format check. A Prisma `String @id @default(uuid())` is a TEXT
        // column, not a Postgres uuid, so an id of the wrong shape matches
        // nothing rather than raising an error.
        //
        // I had a regex guard here on the assumption it was a uuid column. The
        // wave 7 tests found the same wrong assumption in four raw UPDATE
        // statements, where it was written as a `::uuid` cast that would have
        // failed on every single call.
        const deleted = await prisma.expense.deleteMany({ where: { id, organizerId } });
        if (deleted.count === 0) return res.status(404).json({ error: 'Expense not found' });

        res.json({ message: 'Expense deleted' });
    } catch (error: any) {
        logger.error('Error deleting expense', { error: error.message });
        res.status(500).json({ error: 'Failed to delete expense' });
    }
});

export default router;
