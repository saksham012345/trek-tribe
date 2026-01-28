import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../config/api';
import { useToast } from '../../components/ui/Toast';
import LoadingButton from '../../components/ui/LoadingButton';

const RequestTripPage: React.FC = () => {
    const navigate = useNavigate();
    const { add } = useToast();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        destination: '',
        startDate: '',
        endDate: '',
        budgetPerPerson: '',
        numberOfTravelers: 1,
        preferences: '',
        contactPhone: '',
        adminNotes: '' // Admin/Agent can add initial notes if creating on behalf
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.destination || !formData.startDate || !formData.budgetPerPerson) {
                add('Please fill in all required fields', 'error');
                setLoading(false);
                return;
            }

            const payload = {
                ...formData,
                budgetPerPerson: Number(formData.budgetPerPerson),
                numberOfTravelers: Number(formData.numberOfTravelers)
            };

            const response = await api.post('/api/custom-trips', payload);

            if (response.data.success) {
                add('Trip request submitted successfully! Organizers will send proposals soon.', 'success');
                navigate('/my-requests');
            } else {
                add(response.data.error || 'Failed to submit request', 'error');
            }
        } catch (error: any) {
            console.error('Request submission error:', error);
            add(error.response?.data?.error || 'Failed to submit request', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-forest-600 to-nature-600 px-6 py-8 text-center text-white">
                    <h1 className="text-3xl font-bold">Plan Your Custom Adventure</h1>
                    <p className="mt-2 text-forest-100">Tell us where you want to go, and top organizers will plan it for you.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-forest-700 mb-1">Dream Destination *</label>
                            <input
                                type="text"
                                name="destination"
                                value={formData.destination}
                                onChange={handleChange}
                                placeholder="e.g., Manali, Bali, Swiss Alps"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 focus:border-transparent outline-none transition-all"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-forest-700 mb-1">Start Date *</label>
                            <input
                                type="date"
                                name="startDate"
                                value={formData.startDate}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-forest-700 mb-1">End Date (Approx) *</label>
                            <input
                                type="date"
                                name="endDate"
                                value={formData.endDate}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-forest-700 mb-1">Budget Per Person (₹) *</label>
                            <input
                                type="number"
                                name="budgetPerPerson"
                                value={formData.budgetPerPerson}
                                onChange={handleChange}
                                placeholder="15000"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-forest-700 mb-1">Number of Travelers *</label>
                            <input
                                type="number"
                                name="numberOfTravelers"
                                value={formData.numberOfTravelers}
                                onChange={handleChange}
                                min="1"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none"
                                required
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-forest-700 mb-1">Contact Phone</label>
                            <input
                                type="tel"
                                name="contactPhone"
                                value={formData.contactPhone}
                                onChange={handleChange}
                                placeholder="+91 9876543210"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none"
                            />
                            <p className="text-xs text-gray-500 mt-1">We'll only share this with the organizer you choose.</p>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-forest-700 mb-1">Preferences / Special Requests</label>
                            <textarea
                                name="preferences"
                                value={formData.preferences}
                                onChange={handleChange}
                                rows={4}
                                placeholder="e.g., Hotel with view, vegetarian food, easy trekking, etc."
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none resize-none"
                            />
                        </div>
                    </div>

                    <div className="pt-4">
                        <LoadingButton
                            loading={loading}
                            type="submit"
                            className="w-full py-4 bg-gradient-to-r from-forest-600 to-nature-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition-all"
                        >
                            Submit Request
                        </LoadingButton>
                        <p className="text-center text-sm text-gray-500 mt-4">
                            Your request will be reviewed by our admin team before being shared with verified organizers.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RequestTripPage;
