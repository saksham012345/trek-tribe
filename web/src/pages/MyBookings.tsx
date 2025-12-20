import React, { useState, useEffect } from 'react';
import api from '../config/api';
import PaymentUpload from '../components/PaymentUpload';
import BookingDetailsModal from '../components/BookingDetailsModal';

interface Booking {
  bookingId: string;
  tripId: string;
  tripTitle: string;
  destination: string;
  startDate: string;
  endDate: string;
  coverImage?: string;
  numberOfGuests: number;
  totalAmount: number;
  pricePerPerson: number;
  selectedPackage?: string;
  paymentType?: 'full' | 'advance';
  advanceAmount?: number;
  remainingAmount?: number;
  currentPaymentAmount?: number;
  bookingStatus: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  paymentStatus: 'pending' | 'partial' | 'completed' | 'failed' | 'refunded';
  paymentVerificationStatus: 'pending' | 'verified' | 'rejected';
  paymentScreenshotUploaded: boolean;
  tripStatus: string;
  createdAt: string;
  organizer: {
    id: string;
    name: string;
    phone: string;
    email: string;
  };
}

const MyBookings: React.FC = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBookingForPayment, setSelectedBookingForPayment] = useState<Booking | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await api.get('/bookings/my-bookings');
      setBookings((response.data as any).bookings);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (booking: Booking) => {
    if (booking.bookingStatus === 'confirmed') {
      return (
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
          ✅ Confirmed
        </span>
      );
    }
    
    if (booking.bookingStatus === 'pending') {
      if (booking.paymentVerificationStatus === 'verified') {
        return (
          <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            ✅ Payment Verified
          </span>
        );
      } else if (booking.paymentVerificationStatus === 'rejected') {
        return (
          <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
            ❌ Payment Rejected
          </span>
        );
      } else if (booking.paymentScreenshotUploaded) {
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
            ⏳ Awaiting Verification
          </span>
        );
      } else {
        return (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
            📤 {booking.paymentType === 'advance' ? 'Upload Advance Payment Required' : 'Upload Payment Required'}
          </span>
        );
      }
    }
    
    if (booking.bookingStatus === 'cancelled') {
      return (
        <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm font-medium">
          ❌ Cancelled
        </span>
      );
    }
    
    if (booking.bookingStatus === 'completed') {
      return (
        <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
          🎉 Completed
        </span>
      );
    }

    return null;
  };

  const canUploadPayment = (booking: Booking) => {
    return booking.bookingStatus === 'pending' && 
           !booking.paymentScreenshotUploaded && 
           booking.paymentVerificationStatus === 'pending';
  };

  const handlePaymentUploadSuccess = () => {
    setSelectedBookingForPayment(null);
    fetchBookings(); // Refresh the bookings list
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nature-600"></div>
            <span className="ml-3 text-forest-800">Loading your bookings...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-forest-800 mb-2">My Bookings</h1>
          <p className="text-forest-600">Manage your trip bookings and payments</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
            <span className="text-xl">⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {bookings.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="text-6xl mb-4">🎒</div>
            <h2 className="text-2xl font-semibold text-forest-800 mb-2">No Bookings Yet</h2>
            <p className="text-forest-600 mb-6">
              You haven't booked any trips yet. Start exploring amazing adventures!
            </p>
            <a
              href="/"
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-forest-600 to-nature-600 text-white rounded-xl hover:from-forest-700 hover:to-nature-700 transition-all duration-300"
            >
              Explore Trips
            </a>
          </div>
        ) : (
          <div className="grid gap-6">
            {bookings?.map((booking) => (
              <div key={booking.bookingId} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Trip Image */}
                  <div className="md:w-64 h-48 md:h-auto">
                    {booking.coverImage ? (
                      <img
                        src={booking.coverImage}
                        alt={booking.tripTitle}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-forest-200 to-nature-200 flex items-center justify-center">
                        <span className="text-4xl">🏔️</span>
                      </div>
                    )}
                  </div>

                  {/* Booking Details */}
                  <div className="flex-1 p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-xl font-bold text-forest-800 mb-1">
                          {booking.tripTitle}
                        </h3>
                        <p className="text-forest-600 mb-2">📍 {booking.destination}</p>
                        <p className="text-sm text-gray-600">
                          📅 {new Date(booking.startDate).toLocaleDateString()} - {new Date(booking.endDate).toLocaleDateString()}
                        </p>
                      </div>
                      {getStatusBadge(booking)}
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">👥 Travelers</p>
                        <p className="font-semibold text-forest-800">{booking.numberOfGuests}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">💰 Total Amount</p>
                        <p className="font-semibold text-nature-600 text-lg">₹{booking.totalAmount.toLocaleString()}</p>
                        {booking.paymentType === 'advance' && booking.advanceAmount && (
                          <div className="text-xs text-gray-600 mt-1">
                            <p>Advance: ₹{booking.advanceAmount.toLocaleString()}</p>
                            <p>Remaining: ₹{booking.remainingAmount?.toLocaleString()}</p>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">📦 Package</p>
                        <p className="font-semibold text-forest-800">{booking.selectedPackage || 'Standard'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">🗺️ Booked On</p>
                        <p className="font-semibold text-forest-800">{new Date(booking.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>

                    {/* Organizer Info */}
                    <div className="bg-forest-50 rounded-lg p-3 mb-4">
                      <p className="text-sm text-gray-600 mb-1">👨‍💼 Trip Organizer</p>
                      <p className="font-semibold text-forest-800">{booking.organizer.name}</p>
                      <p className="text-sm text-forest-600">{booking.organizer.phone}</p>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 flex-wrap">
                      <button
                        onClick={() => setSelectedBookingForDetails(booking)}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-all duration-300 font-medium flex-1 min-w-[120px]"
                      >
                        📋 View Details
                      </button>
                      
                      {canUploadPayment(booking) && (
                        <button
                          onClick={() => setSelectedBookingForPayment(booking)}
                          className="px-4 py-2 bg-gradient-to-r from-nature-600 to-forest-600 text-white rounded-lg hover:from-nature-700 hover:to-forest-700 transition-all duration-300 font-medium flex-1 min-w-[120px]"
                        >
                          📤 {booking.paymentType === 'advance' ? 'Upload Advance Payment' : 'Upload Payment'}
                        </button>
                      )}
                      
                      {booking.bookingStatus === 'pending' && booking.paymentScreenshotUploaded && (
                        <div className="px-4 py-2 bg-blue-50 text-blue-800 rounded-lg text-center font-medium flex-1 min-w-[120px]">
                          ⏳ Payment Under Review
                        </div>
                      )}
                      
                      {booking.paymentVerificationStatus === 'rejected' && (
                        <button
                          onClick={() => setSelectedBookingForPayment(booking)}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium flex-1 min-w-[120px]"
                        >
                          🔄 Re-upload Payment
                        </button>
                      )}
                      
                      <a
                        href={`/trips/${booking.tripId}`}
                        className="px-4 py-2 border-2 border-forest-300 text-forest-700 rounded-lg hover:bg-forest-100 transition-colors font-medium flex-1 min-w-[120px] text-center"
                      >
                        View Trip
                      </a>
                    </div>

                    {/* Payment Rejection Notice */}
                    {booking.paymentVerificationStatus === 'rejected' && (
                      <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                        <p className="text-sm text-red-800">
                          ❌ Your payment was rejected. Please upload a clear payment screenshot to proceed.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Payment Upload Modal */}
      {selectedBookingForPayment && (
        <PaymentUpload
          bookingId={selectedBookingForPayment.bookingId}
          totalAmount={selectedBookingForPayment.totalAmount}
          organizerId={selectedBookingForPayment.organizer?.id || ''}
          tripTitle={selectedBookingForPayment.tripTitle}
          paymentType={selectedBookingForPayment.paymentType}
          advanceAmount={selectedBookingForPayment.advanceAmount}
          remainingAmount={selectedBookingForPayment.remainingAmount}
          onUploadSuccess={handlePaymentUploadSuccess}
          onCancel={() => setSelectedBookingForPayment(null)}
        />
      )}

      {/* Booking Details Modal */}
      {selectedBookingForDetails && (
        <BookingDetailsModal
          bookingId={selectedBookingForDetails.bookingId}
          onClose={() => setSelectedBookingForDetails(null)}
        />
      )}
    </div>
  );
};

export default MyBookings;