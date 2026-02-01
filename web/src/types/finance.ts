export interface FinanceSummary {
    revenue: number;
    expenses: number;
    netProfit: number;
    profitMargin: number;
    totalDiscounts?: number;
}

export interface Expense {
    _id: string;
    tripId: string;
    category: string;
    amount: number;
    description: string;
    date: Date;
    receiptUrl?: string; // Optional
}

export interface TripFinancials {
    revenue: number;
    expenses: number;
    netProfit: number;
    profitPerTraveler: number;
    discounts: number;
}

export const EXPENSE_CATEGORIES = [
    'Transport',
    'Accommodation',
    'Food',
    'Permits',
    'Guide Fees',
    'Equipment',
    'Marketing',
    'Other'
];
