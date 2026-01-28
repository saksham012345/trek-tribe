import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../config/api';
import { Skeleton } from '../../components/ui/Skeleton';

interface CustomTripRequest {
    _id: string;
    destination: string;
    startDate: string;
    endDate: string;
    budgetPerPerson: number;
    numberOfTravelers: number;
    status: 'pending' | 'approved' | 'rejected' | 'fulfilled';
    createdAt: string;
    proposals?: any[];
}

const MyRequestsPage: React.FC = () => {
    const [requests, setRequests] = useState<CustomTripRequest[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRequests();
    }, []);

    const fetchRequests = async () => {
        try {
            const response = await api.get('/api/custom-trips/my-requests'); // Adjust endpoint if needed
            setRequests(response.data.data || []);
        } catch (error) {
            console.error('Error fetching requests:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'approved': return 'bg-blue-100 text-blue-800';
            case 'fulfilled': return 'bg-green-100 text-green-800';
            case 'rejected': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-8 px-4 sm:px-6 lg:px-8">
            <div className="max-w-5xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-forest-900">My Custom Trips</h1>
                        <p className="text-forest-600 mt-1">Manage your personalized adventure requests</p>
                    </div>
                    <Link
                        to="/request-trip"
                        className="px-6 py-3 bg-nature-600 text-white font-semibold rounded-xl shadow-md hover:bg-nature-700 transition-all flex items-center gap-2"
                    >
                        <span>+</span> New Request
                    </Link>
                </div>

                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                <Skeleton className="h-6 w-1/3 mb-4" />
                                <Skeleton className="h-4 w-1/4" />
                            </div>
                        ))}
                    </div>
                ) : requests.length === 0 ? (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                        <div className="text-6xl mb-4">🌏</div>
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">No Requests Yet</h3>
                        <p className="text-gray-500 mb-6">Start planning your dream trip today.</p>
                        <Link
                            to="/request-trip"
                            className="inline-block px-8 py-3 bg-forest-600 text-white font-semibold rounded-xl hover:bg-forest-700 transition-all"
                        >
                            Start Planning
                        </Link>
                    </div>
                ) : (
                    <div className="grid gap-6">
                        {requests.map((request) => (
                            <div key={request._id} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-lg transition-all group">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-xl font-bold text-gray-900">{request.destination}</h3>
                                            <p className="text-sm text-gray-500">Requested on {new Date(request.createdAt).toLocaleDateString()}</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold uppercase ${getStatusColor(request.status)}`}>
                                            {request.status}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mb-4">
                                        <div>
                                            <span className="block text-gray-500">Dates</span>
                                            <span className="font-medium">{new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}</span>
                                        </div>
                                        <div>
                                            <span className="block text-gray-500">Travelers</span>
                                            <span className="font-medium">{request.numberOfTravelers} Person{request.numberOfTravelers > 1 ? 's' : ''}</span>
                                        </div>
                                        <div>
                                            <span className="block text-gray-500">Budget</span>
                                            <span className="font-medium">₹{request.budgetPerPerson.toLocaleString()}/person</span>
                                        </div>
                                        <div>
                                            <span className="block text-gray-500">Proposals</span>
                                            <span className="font-medium">{request.proposals?.length || 0} received</span>
                                        </div>
                                    </div>

                                    <div className="flex justify-end pt-4 border-t border-gray-100">
                                        <button className="text-nature-600 font-semibold text-sm hover:text-nature-700">
                                            View Details & Proposals →
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyRequestsPage;
