import React, { useState, useEffect } from 'react';
import api from '../config/api';

interface PaymentScreenshot {
  filename: string;
  originalName: string;
  url: string;
  uploadedAt: string;
}

interface Participant {
  name: string;
  email: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  medicalConditions?: string;
  dietaryRestrictions?: string;
  experienceLevel: string;
  specialRequests?: string;
  isMainBooker: boolean;
}

interface BookingDetails {
  _id: string;
  tripTitle: string;
  tripDestination: string;
  mainBooker: {
    name: string;
    email: string;
    phone: string;
  };
  participants: Participant[];
  numberOfGuests: number;
  totalAmount: number;
  pricePerPerson: number;
  selectedPackage?: string;
  paymentMethod: string;
  paymentStatus: string;
  paymentVerificationStatus: 'pending' | 'verified' | 'rejected';
  paymentVerificationNotes?: string;
  paymentScreenshot?: PaymentScreenshot;
  bookingStatus: string;
  specialRequests?: string;
  createdAt: string;
  updatedAt: string;
  verifiedBy?: any;
  verifiedAt?: string;
}

interface PaymentVerificationProps {
  bookingId: string;
  onClose: () => void;
  onVerificationComplete: () => void;
}

const PaymentVerification: React.FC<PaymentVerificationProps> = ({
  bookingId,
  onClose,
  onVerificationComplete
}) => {
  const [booking, setBooking] = useState<BookingDetails | null>(null);
  const [userPermissions, setUserPermissions] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationNotes, setVerificationNotes] = useState('');

  useEffect(() => {
    fetchBookingDetails();
  }, [bookingId]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/bookings/${bookingId}/payment-verification`);
      setBooking((response.data as any).booking);
      setUserPermissions((response.data as any).userPermissions);
      setVerificationNotes((response.data as any).booking.paymentVerificationNotes || '');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to fetch booking details');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async (status: 'verified' | 'rejected') => {
    if (!booking) return;

    setVerificationLoading(true);
    setError('');

    try {
      await api.post(`/bookings/${bookingId}/verify-payment`, {
        status,
        notes: verificationNotes
      });

      onVerificationComplete();
      onClose();
    } catch (error: any) {
      setError(error.response?.data?.error || `Failed to ${status} payment`);
    } finally {
      setVerificationLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-nature-600"></div>
            <span className="ml-2 text-forest-800">Loading booking details...</span>
          </div>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
          <p className="text-red-600 text-center">Failed to load booking details</p>
          <button
            onClick={onClose}
            className="mt-4 w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-forest-800 mb-2">
                Payment Verification
              </h2>
              <p className="text-forest-600">
                {booking.tripTitle} • {booking.tripDestination}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 flex items-center gap-2">
              <span className="text-xl">⚠️</span>
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            {/* Booking Information */}
            <div className="space-y-6">
              {/* Status Badge */}
              <div className="flex items-center gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  booking.paymentVerificationStatus === 'verified' ? 'bg-green-100 text-green-800' :
                  booking.paymentVerificationStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {booking.paymentVerificationStatus === 'verified' ? '✅ Verified' :
                   booking.paymentVerificationStatus === 'rejected' ? '❌ Rejected' :
                   '⏳ Pending Verification'}
                </span>
              </div>

              {/* Main Booker Info */}
              <div className="bg-forest-50 border border-forest-200 rounded-xl p-4">
                <h3 className="font-semibold text-forest-800 mb-3">👤 Main Booker</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Name:</strong> {booking.mainBooker.name}</p>
                  <p><strong>Email:</strong> {booking.mainBooker.email}</p>
                  <p><strong>Phone:</strong> {booking.mainBooker.phone}</p>
                </div>
              </div>

              {/* Booking Details */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                <h3 className="font-semibold text-blue-800 mb-3">📋 Booking Details</h3>
                <div className="space-y-2 text-sm">
                  <p><strong>Travelers:</strong> {booking.numberOfGuests}</p>
                  <p><strong>Package:</strong> {booking.selectedPackage || 'Standard'}</p>
                  <p><strong>Price per person:</strong> ₹{booking.pricePerPerson.toLocaleString()}</p>
                  <p><strong>Total Amount:</strong> ₹{booking.totalAmount.toLocaleString()}</p>
                  <p><strong>Payment Method:</strong> {booking.paymentMethod}</p>
                  <p><strong>Booking Date:</strong> {new Date(booking.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              {/* Participants */}
              <div className="bg-nature-50 border border-nature-200 rounded-xl p-4">
                <h3 className="font-semibold text-nature-800 mb-3">👥 Participants</h3>
                <div className="space-y-3">
                  {booking.participants.map((participant, index) => (
                    <div key={index} className="bg-white rounded-lg p-3 border">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-forest-800">{participant.name}</span>
                        {participant.isMainBooker && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Main Booker</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 space-y-1">
                        <p>Experience: {participant.experienceLevel}</p>
                        {participant.medicalConditions && (
                          <p>Medical: {participant.medicalConditions}</p>
                        )}
                        {participant.dietaryRestrictions && (
                          <p>Dietary: {participant.dietaryRestrictions}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Special Requests */}
              {booking.specialRequests && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                  <h3 className="font-semibold text-gray-800 mb-2">💭 Special Requests</h3>
                  <p className="text-sm text-gray-700">{booking.specialRequests}</p>
                </div>
              )}
            </div>

            {/* Payment Screenshot and Verification */}
            <div className="space-y-6">
              {/* Payment Screenshot */}
              {booking.paymentScreenshot ? (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="font-semibold text-forest-800 mb-3">📸 Payment Screenshot</h3>
                  <div className="text-center">
                    <img
                      src={booking.paymentScreenshot.url}
                      alt="Payment Screenshot"
                      className="max-w-full max-h-96 mx-auto rounded-lg shadow-lg border"
                    />
                    <div className="mt-3 text-sm text-gray-600">
                      <p>Uploaded: {new Date(booking.paymentScreenshot.uploadedAt).toLocaleString()}</p>
                      <p>File: {booking.paymentScreenshot.originalName}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                  <h3 className="font-semibold text-yellow-800 mb-2">⏳ No Payment Screenshot</h3>
                  <p className="text-sm text-yellow-700">
                    The traveler hasn't uploaded their payment screenshot yet.
                  </p>
                </div>
              )}

              {/* Verification Section */}
              {userPermissions.canVerifyPayment && booking.paymentScreenshot && booking.paymentVerificationStatus === 'pending' && (
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <h3 className="font-semibold text-forest-800 mb-3">✅ Payment Verification</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="verificationNotes" className="block text-sm font-medium text-gray-700 mb-2">
                        Verification Notes (Optional)
                      </label>
                      <textarea
                        id="verificationNotes"
                        value={verificationNotes}
                        onChange={(e) => setVerificationNotes(e.target.value)}
                        placeholder="Add any notes about the payment verification..."
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
                      />
                    </div>

                    <div className="flex gap-3">
                      <button
                        onClick={() => handleVerification('rejected')}
                        disabled={verificationLoading}
                        className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {verificationLoading ? '...' : '❌ Reject Payment'}
                      </button>
                      <button
                        onClick={() => handleVerification('verified')}
                        disabled={verificationLoading}
                        className="flex-1 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                      >
                        {verificationLoading ? '...' : '✅ Verify Payment'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Already Verified */}
              {booking.paymentVerificationStatus !== 'pending' && (
                <div className={`border rounded-xl p-4 ${
                  booking.paymentVerificationStatus === 'verified' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}>
                  <h3 className={`font-semibold mb-3 ${
                    booking.paymentVerificationStatus === 'verified' ? 'text-green-800' : 'text-red-800'
                  }`}>
                    {booking.paymentVerificationStatus === 'verified' ? '✅ Payment Verified' : '❌ Payment Rejected'}
                  </h3>
                  {booking.verifiedAt && (
                    <p className="text-sm text-gray-600 mb-2">
                      Verified on: {new Date(booking.verifiedAt).toLocaleString()}
                    </p>
                  )}
                  {booking.paymentVerificationNotes && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                      <p className="text-sm text-gray-600">{booking.paymentVerificationNotes}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentVerification;