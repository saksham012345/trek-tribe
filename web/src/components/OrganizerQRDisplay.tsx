import React, { useState, useEffect } from 'react';
import api from '../config/api';

interface OrganizerQRDisplayProps {
  organizerId: string;
  tripTitle: string;
  totalAmount: number;
  onPaymentComplete: () => void;
}

interface QRCode {
  filename: string;
  originalName: string;
  path: string;
  paymentMethod: string;
  description: string;
  uploadedAt: string;
  isActive: boolean;
  _id: string;
}

const OrganizerQRDisplay: React.FC<OrganizerQRDisplayProps> = ({
  organizerId,
  tripTitle,
  totalAmount,
  onPaymentComplete
}) => {
  const [organizerData, setOrganizerData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchOrganizerData();
  }, [organizerId]);

  const fetchOrganizerData = async () => {
    try {
      // Try multiple endpoints to get organizer data
      let response;
      try {
        // First try the enhanced profile endpoint
        response = await api.get(`/profile/enhanced/${organizerId}`);
        setOrganizerData(response.data.profile || response.data.user);
      } catch (enhancedError) {
        // Fallback to basic profile endpoint
        response = await api.get(`/profile/${organizerId}`);
        setOrganizerData(response.data.profile || response.data.user);
      }
    } catch (error) {
      console.error('Error fetching organizer data:', error);
      setError('Failed to load organizer information');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !organizerData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-red-600">{error || 'Organizer information not available'}</p>
      </div>
    );
  }

  const qrCodes = organizerData.organizerProfile?.qrCodes || [];
  const activeQRCodes = qrCodes.filter((qr: QRCode) => qr.isActive);

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Instructions</h2>
        <p className="text-gray-600">
          Please make payment to complete your booking for <span className="font-semibold">{tripTitle}</span>
        </p>
      </div>

      {/* Organizer Info */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
            {organizerData.profilePhoto ? (
              <img
                src={organizerData.profilePhoto}
                alt={organizerData.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-lg">👤</span>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{organizerData.name}</h3>
            <p className="text-sm text-gray-600">Trip Organizer</p>
          </div>
        </div>
      </div>

      {/* Payment Amount */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="text-center">
          <p className="text-sm text-blue-600 mb-1">Payment Amount</p>
          <p className="text-3xl font-bold text-blue-900">₹{totalAmount.toLocaleString()}</p>
        </div>
      </div>

      {/* QR Codes */}
      {activeQRCodes.length > 0 ? (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 text-center">Scan QR Code to Pay</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeQRCodes.slice(0, 2).map((qrCode: QRCode) => (
              <div key={qrCode._id} className="bg-white border border-gray-200 rounded-lg p-4 text-center">
                <div className="mb-3">
                  <img
                    src={qrCode.path}
                    alt={`${qrCode.paymentMethod} QR Code`}
                    className="w-48 h-48 mx-auto rounded-lg shadow-sm border"
                  />
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-gray-900 capitalize">
                    {qrCode.paymentMethod} Payment
                  </p>
                  {qrCode.description && (
                    <p className="text-sm text-gray-600">{qrCode.description}</p>
                  )}
                  <p className="text-xs text-gray-500">
                    Amount: ₹{totalAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {activeQRCodes.length > 2 && (
            <div className="text-center">
              <p className="text-sm text-gray-500">
                {activeQRCodes.length - 2} more payment method{activeQRCodes.length - 2 > 1 ? 's' : ''} available
              </p>
            </div>
          )}
        </div>
      ) : organizerData.organizerProfile?.paymentQR ? (
        <div className="text-center">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Scan QR Code to Pay</h3>
          <div className="bg-white border border-gray-200 rounded-lg p-4 inline-block">
            <img
              src={organizerData.organizerProfile.paymentQR}
              alt="Payment QR Code"
              className="w-48 h-48 mx-auto rounded-lg shadow-sm border"
            />
            <p className="text-sm text-gray-600 mt-3">Amount: ₹{totalAmount.toLocaleString()}</p>
          </div>
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">Payment Details</h3>
          <p className="text-yellow-700 mb-3">
            QR code not available. Please contact the organizer for payment details.
          </p>
          <div className="space-y-2 text-sm">
            <p><strong>Organizer:</strong> {organizerData.name}</p>
            {organizerData.phone && (
              <p><strong>Phone:</strong> {organizerData.phone}</p>
            )}
          </div>
        </div>
      )}

      {/* Payment Instructions */}
      <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
        <h4 className="font-semibold text-green-800 mb-2">📋 Payment Instructions</h4>
        <ol className="text-sm text-green-700 space-y-1">
          <li>1. Scan the QR code with your payment app</li>
          <li>2. Enter the exact amount: <strong>₹{totalAmount.toLocaleString()}</strong></li>
          <li>3. Add your name or booking reference in the payment note</li>
          <li>4. Complete the payment</li>
          <li>5. Take a screenshot of the payment confirmation</li>
          <li>6. Upload the screenshot below to confirm your booking</li>
        </ol>
      </div>

      {/* Contact Organizer */}
      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          Need help? Contact {organizerData.name}
          {organizerData.phone && (
            <span> at <strong>{organizerData.phone}</strong></span>
          )}
        </p>
      </div>
    </div>
  );
};

export default OrganizerQRDisplay;
