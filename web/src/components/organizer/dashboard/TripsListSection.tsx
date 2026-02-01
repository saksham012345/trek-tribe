import React from 'react';
import { useNavigate } from 'react-router-dom';

interface TripSummary {
    _id: string;
    title: string;
    destination: string;
    startDate: string;
    endDate: string;
    participants: string[];
    capacity: number;
    price: number;
    status: 'active' | 'cancelled' | 'completed';
    pendingVerifications: number;
}

interface TripsListSectionProps {
    trips: TripSummary[];
}

const TripsListSection: React.FC<TripsListSectionProps> = ({ trips }) => {
    const navigate = useNavigate();

    return (
        <>
            {/* Earnings Summary */}
            <div className="max-w-7xl mx-auto mb-8">
                <div className="bg-gradient-to-r from-emerald-500 to-green-600 rounded-2xl shadow-xl p-6 text-white">
                    <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                        💰 Your Earnings Overview
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Total Revenue */}
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                            <p className="text-emerald-100 text-sm mb-1">Total Revenue</p>
                            <p className="text-3xl font-bold">
                                ₹{trips.reduce((total, trip) => total + ((trip.participants?.length || 0) * trip.price), 0).toLocaleString()}
                            </p>
                            <p className="text-emerald-100 text-xs mt-2">From all confirmed bookings</p>
                        </div>

                        {/* Active Trips Revenue */}
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                            <p className="text-emerald-100 text-sm mb-1">Active Trips Revenue</p>
                            <p className="text-3xl font-bold">
                                ₹{trips
                                    .filter(trip => trip.status === 'active')
                                    .reduce((total, trip) => total + ((trip.participants?.length || 0) * trip.price), 0)
                                    .toLocaleString()}
                            </p>
                            <p className="text-emerald-100 text-xs mt-2">
                                {trips.filter(trip => trip.status === 'active').length} active trip{trips.filter(trip => trip.status === 'active').length !== 1 ? 's' : ''}
                            </p>
                        </div>

                        {/* Total Participants */}
                        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20">
                            <p className="text-emerald-100 text-sm mb-1">Total Participants</p>
                            <p className="text-3xl font-bold">
                                {trips.reduce((total, trip) => total + (trip.participants?.length || 0), 0)}
                            </p>
                            <p className="text-emerald-100 text-xs mt-2">
                                Across {trips.length} trip{trips.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto grid lg:grid-cols-3 gap-8">
                {/* Trip Overview */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white rounded-2xl shadow-xl p-6">
                        <h2 className="text-2xl font-bold text-forest-800 mb-6 flex items-center gap-2">
                            🎯 Your Trips Overview
                        </h2>

                        {trips.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">🏕️</div>
                                <h3 className="text-xl font-semibold text-forest-700 mb-2">No trips yet</h3>
                                <p className="text-forest-600">Create your first amazing adventure!</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {trips?.map((trip) => (
                                    <div key={trip._id} className="bg-gradient-to-r from-forest-50 to-nature-50 rounded-xl p-4 border border-forest-200">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <h3 className="text-lg font-semibold text-forest-800">{trip.title}</h3>
                                                <p className="text-forest-600">📍 {trip.destination}</p>
                                            </div>
                                            <div className="text-right">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${trip.status === 'active' ? 'bg-green-100 text-green-800' :
                                                    trip.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-4 gap-4 text-sm">
                                            <div>
                                                <span className="text-forest-600">📅 Dates:</span>
                                                <p className="font-medium text-forest-800">
                                                    {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-forest-600">👥 Participants:</span>
                                                <p className="font-medium text-forest-800">
                                                    {trip.participants?.length || 0} / {trip.capacity}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-forest-600">💰 Price/Person:</span>
                                                <p className="font-medium text-nature-600">
                                                    ₹{trip.price.toLocaleString()}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-forest-600">💵 Trip Revenue:</span>
                                                <p className="font-bold text-emerald-600 text-lg">
                                                    ₹{((trip.participants?.length || 0) * trip.price).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>

                                        {trip.pendingVerifications > 0 && (
                                            <div className="mt-3 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                                <p className="text-sm text-amber-700 font-medium">
                                                    ⚠️ {trip.pendingVerifications} payment(s) pending verification
                                                </p>
                                            </div>
                                        )}

                                        <div className="mt-4 pt-3 border-t border-forest-100 flex justify-end">
                                            <button
                                                onClick={() => navigate(`/organizer/trips/${trip._id}/finance`)}
                                                className="text-sm font-medium text-forest-700 hover:text-forest-900 flex items-center gap-1 transition-colors"
                                            >
                                                💰 Manage Finances →
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default TripsListSection;
