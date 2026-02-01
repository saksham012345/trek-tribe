import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Pie } from 'react-chartjs-2';
import api from '../config/api';
import { ArrowLeft, Plus, Trash2, Calendar, IndianRupee } from 'lucide-react';
import LoadingButton from '../components/ui/LoadingButton';
import { toast } from 'react-toastify';
import { Expense, TripFinancials, EXPENSE_CATEGORIES } from '../types/finance';

ChartJS.register(ArcElement, Tooltip, Legend);

interface TripFinanceData {
    tripSummary: {
        title: string;
        startDate: string;
        status: string;
    };
    financials: TripFinancials;
    breakdown: Record<string, number>;
    transactions: Expense[];
}

const CATEGORIES = [
    'transport', 'stay', 'food', 'guide', 'permits', 'marketing', 'platform_fee', 'miscellaneous'
];

const TripFinancePage: React.FC = () => {
    const { tripId } = useParams<{ tripId: string }>();
    const navigate = useNavigate();
    const [data, setData] = useState<TripFinanceData | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // New Expense Form State
    const [newExpense, setNewExpense] = useState({
        category: 'miscellaneous',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0]
    });

    useEffect(() => {
        fetchData();
    }, [tripId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const res = await api.get(`/finance/trips/${tripId}`);
            setData(res.data);
        } catch (error: any) {
            console.error('Error fetching trip finance:', error);
            toast.error(error.response?.data?.error || 'Failed to load finance data');
        } finally {
            setLoading(false);
        }
    };

    const handleAddExpense = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await api.post('/finance/expenses', {
                tripId,
                ...newExpense,
                amount: Number(newExpense.amount)
            });
            toast.success('Expense added successfully');
            setShowAddModal(false);
            setNewExpense({
                category: 'miscellaneous',
                amount: '',
                description: '',
                date: new Date().toISOString().split('T')[0]
            });
            fetchData(); // Refresh data
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to add expense');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDeleteExpense = async (expenseId: string) => {
        if (!window.confirm('Are you sure you want to delete this expense?')) return;
        try {
            await api.delete(`/finance/expenses/${expenseId}`);
            toast.success('Expense deleted');
            fetchData();
        } catch (error: any) {
            toast.error('Failed to delete expense');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading trip finances...</div>;
    if (!data) return <div className="p-8 text-center text-red-500">Trip not found</div>;

    // Chart Data
    const pieData = {
        labels: data?.breakdown ? Object.keys(data.breakdown).map(k => k.charAt(0).toUpperCase() + k.slice(1)) : [],
        datasets: [
            {
                data: data?.breakdown ? Object.values(data.breakdown) : [],
                backgroundColor: [
                    '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#9CA3AF'
                ],
                borderWidth: 0,
            },
        ],
    };

    // Check if we have data to display chart
    const hasChartData = pieData.datasets[0].data.length > 0 && pieData.datasets[0].data.some(v => v > 0);

    return (
        <div className="min-h-screen bg-gray-50 p-6 font-sans">
            <div className="max-w-6xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <ArrowLeft className="w-6 h-6 text-gray-700" />
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">{data.tripSummary.title}</h1>
                            <p className="text-gray-500 text-sm">Financial Dashboard • {new Date(data.tripSummary.startDate).toLocaleDateString()}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition"
                    >
                        <Plus size={18} /> Add Expense
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 mb-1">Total Revenue</p>
                        <p className="text-2xl font-bold text-gray-900">₹{data.financials.revenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 mb-1">Total Expenses</p>
                        <p className="text-2xl font-bold text-red-600">₹{data.financials.expenses.toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 mb-1">Net Profit</p>
                        <p className={`text-2xl font-bold ${data.financials.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ₹{data.financials.netProfit.toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 mb-1">Total Discounts</p>
                        <p className="text-2xl font-bold text-purple-600">₹{(data.financials.discounts || 0).toLocaleString()}</p>
                    </div>
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <p className="text-sm text-gray-500 mb-1">Profit Per Traveler</p>
                        <p className="text-2xl font-bold text-blue-600">₹{data.financials.profitPerTraveler.toLocaleString()}</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Expense Breakdown Chart */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-1">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">Expense Breakdown</h3>
                        {hasChartData ? (
                            <div className="h-64 flex items-center justify-center">
                                <Pie data={pieData} options={{ maintainAspectRatio: false }} />
                            </div>
                        ) : (
                            <div className="h-64 flex items-center justify-center text-gray-400">
                                No expenses recorded
                            </div>
                        )}
                    </div>

                    {/* Expense List */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 lg:col-span-2 overflow-hidden">
                        <div className="p-6 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-800">Recent Expenses</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 uppercase">
                                    <tr>
                                        <th className="px-6 py-3">Date</th>
                                        <th className="px-6 py-3">Category</th>
                                        <th className="px-6 py-3">Description</th>
                                        <th className="px-6 py-3 text-right">Amount</th>
                                        <th className="px-6 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.transactions.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                No expenses added yet.
                                            </td>
                                        </tr>
                                    ) : (
                                        data.transactions.map((exp) => (
                                            <tr key={exp._id} className="border-b hover:bg-gray-50">
                                                <td className="px-6 py-4 flex items-center gap-2">
                                                    <Calendar size={14} className="text-gray-400" />
                                                    {new Date(exp.date).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="px-2 py-1 bg-gray-100 rounded-md text-xs font-medium text-gray-600 uppercase">
                                                        {exp.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-gray-600 max-w-xs truncate" title={exp.description}>
                                                    {exp.description || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right font-medium text-gray-900">
                                                    ₹{exp.amount.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <button
                                                        onClick={() => handleDeleteExpense(exp._id)}
                                                        className="text-gray-400 hover:text-red-600 transition-colors"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* Add Expense Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-up">
                        <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">Add New Expense</h3>
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleAddExpense} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-gray-400"><IndianRupee size={16} /></span>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-transparent outline-none"
                                        placeholder="0.00"
                                        value={newExpense.amount}
                                        onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                    <select
                                        value={newExpense.category}
                                        onChange={(e) => setNewExpense({ ...newExpense, category: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 focus:border-forest-500"
                                    >
                                        {EXPENSE_CATEGORIES.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                                        value={newExpense.date}
                                        onChange={(e) => setNewExpense({ ...newExpense, date: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                                <textarea
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-forest-500 outline-none"
                                    rows={3}
                                    placeholder="Details about this expense..."
                                    value={newExpense.description}
                                    onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                                />
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition"
                                >
                                    Cancel
                                </button>
                                <LoadingButton
                                    type="submit"
                                    loading={submitting}
                                    className="flex-1"
                                >
                                    Save Expense
                                </LoadingButton>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TripFinancePage;
