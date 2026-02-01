import React from 'react';

interface BookingVerification {
    _id: string;
    tripId: string;
    tripTitle: string;
    travelerName: string;
    travelerEmail: string;
    numberOfGuests: number;
    totalAmount: number;
    paymentScreenshot?: {
        url: string;
        filename: string;
        uploadedAt: string;
    };
    bookingStatus: 'pending' | 'confirmed' | 'cancelled';
    paymentVerificationStatus: 'pending' | 'verified' | 'rejected';
    createdAt: string;
    participants: Array<{
        name: string;
        phone: string;
        age?: number;
    }>;
}

interface PaymentVerificationSectionProps {
    pendingBookings: BookingVerification[];
    verificationLoading: string | null;
    handleVerifyPayment: (bookingId: string, action: 'verify' | 'reject') => void;
    openPaymentScreenshot: (url: string) => void;
}

const PaymentVerificationSection: React.FC<PaymentVerificationSectionProps> = ({
    pendingBookings,
    verificationLoading,
    handleVerifyPayment,
    openPaymentScreenshot
}) => {
    return (
        <div className="space-y-6 lg:col-start-3 lg:row-start-2">
            <div className="bg-white rounded-2xl shadow-xl p-6">
                <h2 className="text-2xl font-bold text-forest-800 mb-6 flex items-center gap-2">
                    💳 Payment Verification
                </h2>

                {pendingBookings.length === 0 ? (
                    <div className="text-center py-8">
                        <div className="text-4xl mb-3">✅</div>
                        <h3 className="text-lg font-semibold text-forest-700 mb-1">All caught up!</h3>
                        <p className="text-sm text-forest-600">No payments pending verification.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {pendingBookings?.map((booking) => (
                            <div key={booking._id} className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                                <div className="flex justify-between items-start mb-3">
                                    <div>
                                        <h3 className="font-semibold text-forest-800">{booking.travelerName}</h3>
                                        <p className="text-sm text-forest-600">{booking.tripTitle}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-lg font-bold text-nature-600">
                                            ₹{booking.totalAmount.toLocaleString()}
                                        </p>
                                        <p className="text-xs text-forest-500">
                                            {booking.numberOfGuests} traveler{booking.numberOfGuests > 1 ? 's' : ''}
                                        </p>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <div className="text-sm">
                                        <p className="text-forest-600 mb-1">Travelers:</p>
                                        <div className="space-y-1">
                                            {booking.participants?.map((participant, index) => (
                                                <div key={index} className="flex justify-between bg-white rounded-lg p-2">
                                                    <span className="font-medium">{participant.name}</span>
                                                    <span className="text-forest-600">{participant.phone}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {booking.paymentScreenshot && (
                                        <div>
                                            <p className="text-sm text-forest-600 mb-2">Payment Screenshot:</p>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => openPaymentScreenshot(booking.paymentScreenshot!.url)}
                                                    className="text-blue-600 hover:text-blue-800 text-sm underline"
                                                >
                                                    📄 View Screenshot
                                                </button>
                                                <span className="text-xs text-forest-500">
                                                    Uploaded: {new Date(booking.paymentScreenshot.uploadedAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex gap-2 pt-2">
                                        <button
                                            onClick={() => handleVerifyPayment(booking._id, 'verify')}
                                            disabled={verificationLoading === booking._id}
                                            className="flex-1 px-3 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {verificationLoading === booking._id ? '⏳' : '✅'} Verify
                                        </button>
                                        <button
                                            onClick={() => handleVerifyPayment(booking._id, 'reject')}
                                            disabled={verificationLoading === booking._id}
                                            className="flex-1 px-3 py-2 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {verificationLoading === booking._id ? '⏳' : '❌'} Reject
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-3 pt-2 border-t border-blue-200 text-xs text-forest-500">
                                    Booking created: {new Date(booking.createdAt).toLocaleString()}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default PaymentVerificationSection;
