import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    PointElement,
    LineElement,
    ArcElement,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import { TrendingUp, DollarSign, PieChart, CreditCard } from 'lucide-react';
import { FinanceSummary } from '../../types/finance';

// Register ChartJS components
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    PointElement,
    LineElement,
    ArcElement
);

interface ExpenseStatsProps {
    summary: FinanceSummary;
    graphData?: any; // To be typed strictly later if needed
    loading: boolean;
}

const ExpenseStats: React.FC<ExpenseStatsProps> = ({ summary, graphData, loading }) => {
    if (loading) {
        return <div className="p-8 text-center text-gray-500">Loading financial data...</div>;
    }

    // Currency formatter
    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(amount);
    };

    // Safe margin color
    const getMarginColor = (margin: number) => {
        if (margin >= 20) return 'text-green-600 bg-green-50';
        if (margin > 0) return 'text-yellow-600 bg-yellow-50';
        return 'text-red-600 bg-red-50';
    };

    // Mock data for graphs if not provided (for development/visualization)
    const revenueExpensesData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
            {
                label: 'Revenue',
                data: [12000, 19000, 3000, 5000, 2000, 30000],
                backgroundColor: 'rgba(34, 197, 94, 0.6)', // Green
            },
            {
                label: 'Expenses',
                data: [8000, 15000, 4000, 3000, 2500, 20000],
                backgroundColor: 'rgba(239, 68, 68, 0.6)', // Red
            },
        ],
    };

    const profitTrendData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
            {
                label: 'Net Profit',
                data: [4000, 4000, -1000, 2000, -500, 10000],
                borderColor: 'rgb(59, 130, 246)', // Blue
                backgroundColor: 'rgba(59, 130, 246, 0.5)',
                tension: 0.3,
            },
        ],
    };

    const options = {
        responsive: true,
        plugins: {
            legend: {
                position: 'top' as const,
            },
        },
    };

    return (
        <div className="space-y-8 animate-fadeIn">
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Revenue */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 text-sm font-medium">Total Revenue</h3>
                        <div className="p-2 bg-green-50 rounded-lg text-green-600">
                            <DollarSign size={20} />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.revenue)}</p>
                    <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                        <TrendingUp size={14} />
                        <span>Actual income from bookings</span>
                    </div>
                </div>

                {/* Expenses */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 text-sm font-medium">Total Expenses</h3>
                        <div className="p-2 bg-red-50 rounded-lg text-red-600">
                            <CreditCard size={20} />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.expenses)}</p>
                    <div className="mt-2 text-xs text-red-500 flex items-center gap-1">
                        <TrendingUp size={14} />
                        <span>Reported costs</span>
                    </div>
                </div>

                {/* Net Profit */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 text-sm font-medium">Net Profit</h3>
                        <div className={`p-2 rounded-lg ${summary.netProfit >= 0 ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>
                            <TrendingUp size={20} />
                        </div>
                    </div>
                    <p className={`text-2xl font-bold ${summary.netProfit >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                        {formatCurrency(summary.netProfit)}
                    </p>
                    <div className="mt-2 text-xs text-blue-600">
                        Revenue - Expenses
                    </div>
                </div>

                {/* Discounts (New) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 text-sm font-medium">Total Discounts</h3>
                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                            <PieChart size={20} />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(summary.totalDiscounts || 0)}</p>
                    <div className="mt-2 text-xs text-purple-600">
                        Given to travelers
                    </div>
                </div>

                {/* Profit Margin */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-gray-500 text-sm font-medium">Profit Margin</h3>
                        <div className={`p-2 rounded-lg ${getMarginColor(summary.profitMargin)}`}>
                            <PieChart size={20} />
                        </div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{summary.profitMargin}%</p>
                    <div className={`mt-2 text-xs inline-flex items-center px-2 py-0.5 rounded ${getMarginColor(summary.profitMargin)}`}>
                        {summary.profitMargin >= 20 ? 'Healthy' : summary.profitMargin > 0 ? 'Low Margin' : 'Loss'}
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Revenue vs Expenses Bar Custom */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Monthly Revenue vs Expenses</h3>
                    <Bar options={options} data={revenueExpensesData} />
                </div>

                {/* Profit Trend Line */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 mb-6">Profit Trend</h3>
                    <Line options={options} data={profitTrendData} />
                </div>
            </div>
        </div>
    );
};

export default ExpenseStats;
