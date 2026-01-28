import React, { useState, useEffect } from 'react';
import api from '../../config/api';
import { useToast } from '../ui/Toast';

interface BankDetails {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    upiId?: string;
}

const BankDetailsTab: React.FC = () => {
    const { add } = useToast();
    const [bankDetails, setBankDetails] = useState<BankDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState<BankDetails>({
        accountHolderName: '',
        accountNumber: '',
        ifscCode: '',
        bankName: '',
        upiId: '',
    });

    useEffect(() => {
        fetchBankDetails();
    }, []);

    const fetchBankDetails = async () => {
        try {
            const response = await api.get('/api/crm/bank-details');
            if (response.data.success) {
                setBankDetails(response.data.data);
                setFormData(response.data.data);
            }
        } catch (error: any) {
            if (error.response?.status !== 404) {
                console.error('Failed to fetch bank details:', error);
            }
            // 404 means no bank details yet - that's okay
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setLoading(true);
            const response = await api.put('/api/crm/bank-details', formData);

            if (response.data.success) {
                setBankDetails(response.data.data);
                setEditing(false);
                add('Bank details updated successfully', 'success');
            }
        } catch (error: any) {
            console.error('Failed to update bank details:', error);
            add(error.response?.data?.message || 'Failed to update bank details', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm('Are you sure you want to delete your bank details?')) {
            return;
        }

        try {
            setLoading(true);
            await api.delete('/api/crm/bank-details');
            setBankDetails(null);
            setFormData({
                accountHolderName: '',
                accountNumber: '',
                ifscCode: '',
                bankName: '',
                upiId: '',
            });
            add('Bank details deleted successfully', 'success');
        } catch (error: any) {
            console.error('Failed to delete bank details:', error);
            add(error.response?.data?.message || 'Failed to delete bank details', 'error');
        } finally {
            setLoading(false);
        }
    };

    if (loading && !editing) {
        return (
            <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-300 border-t-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading bank details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-xl font-bold text-gray-900">🏦 Bank Details</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        Manage your bank account for receiving payments (4% platform commission)
                    </p>
                </div>
                {bankDetails && !editing && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => setEditing(true)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                        >
                            ✏️ Edit
                        </button>
                        <button
                            onClick={handleDelete}
                            className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                        >
                            🗑️ Delete
                        </button>
                    </div>
                )}
            </div>

            {!bankDetails && !editing ? (
                <div className="text-center py-12">
                    <span className="text-6xl">🏦</span>
                    <p className="text-gray-500 mt-4 mb-6">No bank details added yet</p>
                    <button
                        onClick={() => setEditing(true)}
                        className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                        ➕ Add Bank Details
                    </button>
                </div>
            ) : editing ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                        <p className="text-sm text-blue-800">
                            <strong>🔒 Security:</strong> Your account number will be encrypted and stored securely.
                            Only the last 4 digits will be visible. Platform commission is 4% - you receive 96% of payments.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Account Holder Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.accountHolderName}
                            onChange={(e) => setFormData({ ...formData, accountHolderName: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="John Doe"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Bank Account Number *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.accountNumber}
                            onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value.replace(/\D/g, '') })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
                            placeholder="1234567890123456"
                        />
                        <p className="text-xs text-gray-500 mt-1">Will be encrypted and masked (****1234)</p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            IFSC Code *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.ifscCode}
                            onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value.toUpperCase() })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono uppercase"
                            placeholder="SBIN0001234"
                            maxLength={11}
                        />
                        <p className="text-xs text-gray-500 mt-1">11 characters (e.g., SBIN0001234)</p>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Bank Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.bankName}
                            onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="State Bank of India"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            UPI ID (Optional)
                        </label>
                        <input
                            type="text"
                            value={formData.upiId}
                            onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="yourname@upi"
                        />
                        <p className="text-xs text-gray-500 mt-1">For QR code payments (e.g., yourname@paytm)</p>
                    </div>

                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={() => {
                                setEditing(false);
                                if (bankDetails) {
                                    setFormData(bankDetails);
                                }
                            }}
                            className="flex-1 px-4 py-3 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Saving...' : 'Save Bank Details'}
                        </button>
                    </div>
                </form>
            ) : (
                <div className="space-y-4">
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Account Holder Name</p>
                            <p className="font-semibold text-gray-900">{bankDetails?.accountHolderName}</p>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Account Number</p>
                            <p className="font-mono font-semibold text-gray-900">{bankDetails?.accountNumber}</p>
                            <p className="text-xs text-gray-500 mt-1">🔒 Encrypted</p>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">IFSC Code</p>
                            <p className="font-mono font-semibold text-gray-900">{bankDetails?.ifscCode}</p>
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg">
                            <p className="text-sm text-gray-600 mb-1">Bank Name</p>
                            <p className="font-semibold text-gray-900">{bankDetails?.bankName}</p>
                        </div>

                        {bankDetails?.upiId && (
                            <div className="p-4 bg-gray-50 rounded-lg md:col-span-2">
                                <p className="text-sm text-gray-600 mb-1">UPI ID</p>
                                <p className="font-mono font-semibold text-gray-900">{bankDetails.upiId}</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <p className="text-sm text-green-800">
                            <strong>✅ Payment Settlement:</strong> You will receive 96% of all payments directly to this account.
                            Platform commission is 4%. Settlements are processed automatically.
                        </p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BankDetailsTab;
