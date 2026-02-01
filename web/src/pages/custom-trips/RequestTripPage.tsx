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
        flexibleDates: false,
        budget: '', // Changed from budgetPerPerson to budget (total) or per person based on UI decision, keeping backend 'budget' in mind
        numberOfTravelers: 1,
        tripType: 'mixed',
        experienceLevel: 'beginner',
        ageGroup: 'mixed',
        specialNeeds: '',
        privacyLevel: 'private',
        preferences: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (!formData.destination || !formData.startDate || !formData.budget) {
                add('Please fill in all required fields', 'error');
                setLoading(false);
                return;
            }

            const payload = {
                destination: formData.destination,
                startDate: formData.startDate,
                endDate: formData.endDate,
                flexibleDates: formData.flexibleDates,
                budget: Number(formData.budget),
                numberOfTravelers: Number(formData.numberOfTravelers),
                tripType: formData.tripType,
                experienceLevel: formData.experienceLevel,
                ageGroup: formData.ageGroup,
                specialNeeds: formData.specialNeeds,
                privacyLevel: formData.privacyLevel,
                preferences: formData.preferences
            };

            const response = await api.post('/api/custom-trips', payload);

            if (response.data) {
                add('Trip request submitted successfully! Organizers will send proposals soon.', 'success');
                navigate('/my-requests'); // Ensure this route exists or update to dashboard
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
            <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-xl overflow-hidden">
                <div className="bg-gradient-to-r from-forest-600 to-nature-600 px-6 py-8 text-center text-white">
                    <h1 className="text-3xl font-bold">Plan Your Custom Adventure</h1>
                    <p className="mt-2 text-forest-100">Tell us your unique travel style, and we'll route you to the best verified organizers.</p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {/* Destination & Dates */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-forest-700 mb-1">Dream Destination *</label>
                            <input
                                type="text"
                                name="destination"
                                value={formData.destination}
                                onChange={handleChange}
                                placeholder="e.g., Manali, Bali, Swiss Alps"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none"
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

                        <div className="col-span-2 flex items-center">
                            <input
                                type="checkbox"
                                name="flexibleDates"
                                checked={formData.flexibleDates}
                                onChange={handleChange}
                                className="h-4 w-4 text-nature-600 focus:ring-nature-500 border-gray-300 rounded"
                            />
                            <label className="ml-2 block text-sm text-gray-900">
                                My dates are flexible (+/- 3 days)
                            </label>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Trip Details */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-forest-700 mb-1">Total Budget (₹) *</label>
                            <input
                                type="number"
                                name="budget"
                                value={formData.budget}
                                onChange={handleChange}
                                placeholder="50000"
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

                        <div>
                            <label className="block text-sm font-medium text-forest-700 mb-1">Trip Type</label>
                            <select
                                name="tripType"
                                value={formData.tripType}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none"
                            >
                                <option value="mixed">Mixed / Balanced</option>
                                <option value="relaxed">Relaxed / Leisure</option>
                                <option value="adventure">Adventure / Trekking</option>
                                <option value="cultural">Cultural / Heritage</option>
                                <option value="religious">Religious / Pilgrimage</option>
                                <option value="wildlife">Wildlife / Safari</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-forest-700 mb-1">Privacy Level</label>
                            <select
                                name="privacyLevel"
                                value={formData.privacyLevel}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none"
                            >
                                <option value="private">Private (Invite only)</option>
                                <option value="invite-only">Restricted</option>
                            </select>
                        </div>
                    </div>

                    <hr className="border-gray-100" />

                    {/* Group Dynamics */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-forest-700 mb-1">Group Experience Level</label>
                            <select
                                name="experienceLevel"
                                value={formData.experienceLevel}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none"
                            >
                                <option value="beginner">Beginner (First Time)</option>
                                <option value="intermediate">Intermediate (Occasional)</option>
                                <option value="advanced">Advanced (Pro)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-forest-700 mb-1">Age Group</label>
                            <select
                                name="ageGroup"
                                value={formData.ageGroup}
                                onChange={handleChange}
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none"
                            >
                                <option value="mixed">Mixed Ages</option>
                                <option value="18-25">18-25 (Young Adults)</option>
                                <option value="25-40">25-40</option>
                                <option value="40-60">40-60</option>
                                <option value="family">Family with Kids</option>
                                <option value="seniors">Seniors (60+)</option>
                            </select>
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-forest-700 mb-1">Special Needs / Accessibility</label>
                            <input
                                type="text"
                                name="specialNeeds"
                                value={formData.specialNeeds}
                                onChange={handleChange}
                                placeholder="e.g., Wheelchair access, vegetarian food, elderly assistance"
                                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-nature-500 outline-none"
                            />
                        </div>

                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-forest-700 mb-1">Additional Preferences</label>
                            <textarea
                                name="preferences"
                                value={formData.preferences}
                                onChange={handleChange}
                                rows={4}
                                placeholder="Tell us more about what you're looking for..."
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
                            Request Custom Trip
                        </LoadingButton>
                        <p className="text-center text-sm text-gray-500 mt-4">
                            Your request will be routed to Verified Organizers (Trust Score 60+) only.
                        </p>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default RequestTripPage;
