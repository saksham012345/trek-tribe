import mongoose, { Schema, Document, Model, Types } from 'mongoose';

export interface ExpenseDocument extends Document {
    organizerId: Types.ObjectId;
    tripId: Types.ObjectId;
    category: 'transport' | 'stay' | 'food' | 'guide' | 'permits' | 'marketing' | 'platform_fee' | 'miscellaneous';
    amount: number;
    description?: string;
    date: Date;
    createdAt: Date;
    updatedAt: Date;
}

const expenseSchema = new Schema(
    {
        organizerId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
        tripId: { type: Schema.Types.ObjectId, ref: 'Trip', required: true, index: true },
        category: {
            type: String,
            enum: ['transport', 'stay', 'food', 'guide', 'permits', 'marketing', 'platform_fee', 'miscellaneous'],
            required: true
        },
        amount: { type: Number, required: true, min: 0 },
        description: { type: String, maxlength: 500 },
        date: { type: Date, required: true, default: Date.now }
    },
    { timestamps: true }
);

// Indexes for aggregating expenses
expenseSchema.index({ tripId: 1, category: 1 });
expenseSchema.index({ organizerId: 1, date: -1 });

export const Expense = (mongoose.models.Expense || mongoose.model<ExpenseDocument>('Expense', expenseSchema)) as Model<ExpenseDocument>;
