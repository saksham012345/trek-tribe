import React, { useState, useEffect } from 'react';
import api from '../config/api';

interface UserEditModalProps {
    user: any;
    onClose: () => void;
    onUpdate: () => void;
}

export const UserEditModal: React.FC<UserEditModalProps> = ({ user, onClose, onUpdate }) => {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [subscription, setSubscription] = useState<any>(null);
    const [crmAccess, setCrmAccess] = useState(false);
    const [addTrips, setAddTrips] = useState<string>(''); // string for input
    const [selectedPlan, setSelectedPlan] = useState('');
    const [verificationStatus, setVerificationStatus] = useState<'pending' | 'approved' | 'rejected' | undefined>(user.organizerVerificationStatus);

    useEffect(() => {
        fetchSubscription();
    }, [user]);

    const fetchSubscription = async () => {
        try {
            const response = await api.get(`/admin/users/${user._id}/subscription`);
            if (response.data.hasSubscription) {
                setSubscription(response.data.subscription);
                setCrmAccess(response.data.subscription.crmAccess);
                setSelectedPlan(response.data.subscription.plan);
            }
        } catch (error) {
            console.error('Failed to fetch subscription', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            // 1. Update Subscription
            await api.post(`/admin/users/${user._id}/subscription-override`, {
                crmAccess,
                addTrips: addTrips ? parseInt(addTrips) : undefined,
                setPlan: selectedPlan !== subscription?.plan ? selectedPlan : undefined
            });

            // 2. Update Verification if changed (assuming there's an endpoint for this, typically handled by verify/reject endpoints but straightforward to add patch if needed, for now focusing on subscription as per request)
            // The user manual request was about "allow trip creation and active crm". Trip creation is usually blocked by verification or trip limits.
            // If we need to verify organizer manually:
            /*
            if (verificationStatus !== user.organizerVerificationStatus) {
               // Call verification endpoint
            }
            */

            onUpdate();
            onClose();
        } catch (error) {
            console.error('Failed to update user', error);
            alert('Failed to update user settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"><div className="bg-white p-6 rounded-lg">Loading...</div></div>;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-900">Manage User: {user.name}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
                </div>

                <div className="space-y-6">
                    {/* Subscription Section */}
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-semibold text-gray-700 uppercase mb-3">Subscription & Access</h3>

                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">CRM Access</label>
                                <p className="text-xs text-gray-500">Enable full CRM features for this user.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={crmAccess}
                                    onChange={(e) => setCrmAccess(e.target.checked)}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-forest-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-forest-600"></div>
                            </label>
                        </div>

                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Add Trip Credits</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    value={addTrips}
                                    onChange={(e) => setAddTrips(e.target.value)}
                                    placeholder="Number of trips to add"
                                    className="block w-full rounded-md border-gray-300 shadow-sm focus:border-forest-500 focus:ring-forest-500 sm:text-sm p-2 border"
                                />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Current Balance: {subscription?.tripsRemaining || 0} trips remaining</p>
                        </div>

                        <div className="mb-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">Plan Override</label>
                            <select
                                value={selectedPlan}
                                onChange={(e) => setSelectedPlan(e.target.value)}
                                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-forest-500 focus:ring-forest-500 sm:text-sm p-2 border"
                            >
                                <option value="trial">Trial</option>
                                <option value="starter">Starter</option>
                                <option value="basic">Basic</option>
                                <option value="professional">Professional</option>
                                <option value="premium">Premium</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg">
                        <h3 className="text-sm font-semibold text-blue-900 mb-2">User Details</h3>
                        <p className="text-sm text-gray-700">Role: <span className="font-medium capitalize">{user.role}</span></p>
                        <p className="text-sm text-gray-700">Email: {user.email}</p>
                        <p className="text-sm text-gray-700">Phone: {user.phone || 'N/A'}</p>
                    </div>

                </div>

                <div className="mt-8 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-500"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-medium text-white bg-forest-600 rounded-md hover:bg-forest-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-forest-500 disabled:opacity-50"
                    >
                        {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};
