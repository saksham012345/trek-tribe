import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: any;
  user: any;
}

interface Participant {
  name: string;
  email: string;
  phone: string;
  emergencyContact: {
    name: string;
    phone: string;
    relationship: string;
  };
}

const BookingModal: React.FC<BookingModalProps> = ({ isOpen, onClose, trip, user }) => {
  const [step, setStep] = useState(1);
  const [participants, setParticipants] = useState<Participant[]>([
    {
      name: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      emergencyContact: { name: '', phone: '', relationship: '' }
    }
  ]);
  const [paymentType, setPaymentType] = useState<'full' | 'advance'>('full');
  const [paymentMethod, setPaymentMethod] = useState<'qr_code' | 'upi' | 'card'>('qr_code');
  const [bookingData, setBookingData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const totalAmount = trip?.price * participants.length || 0;
  const advanceAmount = trip?.paymentOptions?.advanceAmount || Math.round(totalAmount * 0.3);
  const paymentAmount = paymentType === 'advance' ? advanceAmount : totalAmount;

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setError('');
      setBookingData(null);
    }
  }, [isOpen]);

  const addParticipant = () => {
    if (participants.length < 10) {
      setParticipants([
        ...participants,
        {
          name: '',
          email: '',
          phone: '',
          emergencyContact: { name: '', phone: '', relationship: '' }
        }
      ]);
    }
  };

  const removeParticipant = (index: number) => {
    if (participants.length > 1) {
      setParticipants(participants.filter((_, i) => i !== index));
    }
  };

  const updateParticipant = (index: number, field: string, value: string) => {
    const updated = [...participants];
    if (field.includes('emergencyContact.')) {
      const subField = field.split('.')[1];
      updated[index].emergencyContact = {
        ...updated[index].emergencyContact,
        [subField]: value
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setParticipants(updated);
  };

  const validateStep = (stepNumber: number) => {
    if (stepNumber === 1) {
      return participants.every(p => 
        p.name && p.email && p.emergencyContact.name && 
        p.emergencyContact.phone && p.emergencyContact.relationship
      );
    }
    return true;
  };

  const handleBooking = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/payments/book', {
        tripId: trip._id,
        paymentType,
        paymentMethod,
        participants
      });

      if (response.data?.success) {
        setBookingData(response.data.payment);
        setStep(3);
      } else {
        setError('Failed to create booking');
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to create booking');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">Book Your Adventure</h2>
            <p className="text-gray-600">{trip?.title}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ✕
          </button>
        </div>

        {/* Progress Indicator */}
        <div className="px-6 py-4 border-b">
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${step >= 1 ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">Participants</span>
            </div>
            <div className="flex-1 border-t-2 border-gray-200"></div>
            <div className={`flex items-center ${step >= 2 ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">Payment</span>
            </div>
            <div className="flex-1 border-t-2 border-gray-200"></div>
            <div className={`flex items-center ${step >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-green-600 text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="ml-2 text-sm font-medium">Confirmation</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 1 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Participant Details</h3>
              
              {participants.map((participant, index) => (
                <div key={index} className="border rounded-lg p-4 mb-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium">Participant {index + 1}</h4>
                    {participants.length > 1 && (
                      <button
                        onClick={() => removeParticipant(index)}
                        className="text-red-500 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={participant.name}
                      onChange={(e) => updateParticipant(index, 'name', e.target.value)}
                      className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={participant.email}
                      onChange={(e) => updateParticipant(index, 'email', e.target.value)}
                      className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      required
                    />
                    <input
                      type="tel"
                      placeholder="Phone Number"
                      value={participant.phone}
                      onChange={(e) => updateParticipant(index, 'phone', e.target.value)}
                      className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  
                  <div className="border-t pt-3">
                    <h5 className="font-medium text-sm text-gray-700 mb-2">Emergency Contact</h5>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <input
                        type="text"
                        placeholder="Contact Name"
                        value={participant.emergencyContact.name}
                        onChange={(e) => updateParticipant(index, 'emergencyContact.name', e.target.value)}
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        required
                      />
                      <input
                        type="tel"
                        placeholder="Contact Phone"
                        value={participant.emergencyContact.phone}
                        onChange={(e) => updateParticipant(index, 'emergencyContact.phone', e.target.value)}
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        required
                      />
                      <input
                        type="text"
                        placeholder="Relationship"
                        value={participant.emergencyContact.relationship}
                        onChange={(e) => updateParticipant(index, 'emergencyContact.relationship', e.target.value)}
                        className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
              
              {participants.length < 10 && (
                <button
                  onClick={addParticipant}
                  className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors"
                >
                  + Add Another Participant
                </button>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Payment Options</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Trip Price per person:</span>
                  <span className="text-lg font-bold">₹{trip?.price}</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium">Number of participants:</span>
                  <span>{participants.length}</span>
                </div>
                <div className="border-t pt-2 flex justify-between items-center">
                  <span className="font-bold text-lg">Total Amount:</span>
                  <span className="text-xl font-bold text-blue-600">₹{totalAmount}</span>
                </div>
              </div>

              {trip?.paymentOptions?.allowAdvancePayment && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3">Payment Type</h4>
                  <div className="space-y-3">
                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="paymentType"
                        value="full"
                        checked={paymentType === 'full'}
                        onChange={(e) => setPaymentType(e.target.value as 'full' | 'advance')}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium">Full Payment</div>
                        <div className="text-sm text-gray-600">Pay the complete amount now: ₹{totalAmount}</div>
                      </div>
                    </label>
                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                      <input
                        type="radio"
                        name="paymentType"
                        value="advance"
                        checked={paymentType === 'advance'}
                        onChange={(e) => setPaymentType(e.target.value as 'full' | 'advance')}
                        className="mr-3"
                      />
                      <div>
                        <div className="font-medium">Advance Payment</div>
                        <div className="text-sm text-gray-600">
                          Pay ₹{advanceAmount} now, balance ₹{totalAmount - advanceAmount} before trip starts
                        </div>
                      </div>
                    </label>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <h4 className="font-medium mb-3">Payment Method</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="qr_code"
                      checked={paymentMethod === 'qr_code'}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">QR Code</div>
                      <div className="text-xs text-gray-500">UPI/Scanner</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="upi"
                      checked={paymentMethod === 'upi'}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">UPI</div>
                      <div className="text-xs text-gray-500">Direct UPI</div>
                    </div>
                  </label>
                  <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                    <input
                      type="radio"
                      name="paymentMethod"
                      value="card"
                      checked={paymentMethod === 'card'}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="mr-3"
                    />
                    <div>
                      <div className="font-medium">Card</div>
                      <div className="text-xs text-gray-500">Credit/Debit</div>
                    </div>
                  </label>
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                <h5 className="font-medium text-yellow-800 mb-2">Important Terms</h5>
                <ul className="text-sm text-yellow-700 space-y-1">
                  <li>• {paymentType === 'advance' ? `₹${advanceAmount} must be paid now` : `₹${totalAmount} must be paid now`}</li>
                  <li>• Cancellation policy: {trip?.cancellationPolicy || 'Standard cancellation policy applies'}</li>
                  <li>• Refund policy: {trip?.paymentOptions?.refundPolicy || 'Refunds as per policy'}</li>
                </ul>
              </div>
            </div>
          )}

          {step === 3 && bookingData && (
            <div className="text-center">
              <div className="mb-6">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-green-600 mb-2">Booking Created Successfully!</h3>
                <p className="text-gray-600 mb-4">Booking ID: {bookingData.bookingId}</p>
              </div>

              {paymentMethod === 'qr_code' && bookingData.qrCodeData && (
                <div className="mb-6">
                  <h4 className="font-medium mb-3">Scan QR Code to Pay</h4>
                  <div className="bg-white border-2 border-gray-300 rounded-lg p-4 inline-block">
                    <div className="text-6xl">📱</div>
                    <div className="text-xs text-gray-500 mt-2">QR Code Scanner</div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    Scan this QR code with your UPI app to pay ₹{bookingData.amount}
                  </p>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Amount:</span>
                    <span className="ml-2">₹{bookingData.amount}</span>
                  </div>
                  <div>
                    <span className="font-medium">Payment Type:</span>
                    <span className="ml-2 capitalize">{bookingData.paymentType}</span>
                  </div>
                  <div>
                    <span className="font-medium">Participants:</span>
                    <span className="ml-2">{bookingData.participants}</span>
                  </div>
                  <div>
                    <span className="font-medium">Status:</span>
                    <span className="ml-2 text-yellow-600 capitalize">{bookingData.status}</span>
                  </div>
                </div>
              </div>

              {bookingData.termsAndConditions?.advancePaymentNote && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-blue-700">{bookingData.termsAndConditions.advancePaymentNote}</p>
                </div>
              )}

              <p className="text-sm text-gray-600">
                You will receive a confirmation email once the payment is processed.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex items-center justify-between">
          {step > 1 && step < 3 && (
            <button
              onClick={() => setStep(step - 1)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Back
            </button>
          )}
          
          <div className="flex-1"></div>
          
          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!validateStep(1)}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Continue to Payment
            </button>
          )}
          
          {step === 2 && (
            <button
              onClick={handleBooking}
              disabled={loading}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              {loading ? 'Processing...' : `Pay ₹${paymentAmount}`}
            </button>
          )}
          
          {step === 3 && (
            <button
              onClick={onClose}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookingModal;