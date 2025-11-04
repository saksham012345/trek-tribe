import React, { useState, useEffect } from 'react';
import api, { API_BASE_URL } from '../config/api';

interface OrganizerQRDisplayProps {
  organizerId: string;
  tripTitle: string;
  totalAmount: number;
  paymentType?: 'full' | 'advance';
  advanceAmount?: number;
  remainingAmount?: number;
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
  paymentType = 'full',
  advanceAmount,
  remainingAmount,
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
        // First try the enhanced profile endpoint (shape: { success, data: { user } })
        response = await api.get(`/profile/enhanced/${organizerId}`);
        const dataUser = (response.data as any)?.data?.user;
        if (dataUser) {
          setOrganizerData(dataUser);
          return;
        }
      } catch (enhancedError) {
        // continue to fallback
      }

      // Fallback to organizer by unique URL if available, otherwise basic profile if implemented
      try {
        response = await api.get(`/profile/${organizerId}`);
        const fallbackUser = (response.data as any)?.data?.user || (response.data as any)?.user || (response.data as any)?.profile;
        if (fallbackUser) {
          setOrganizerData(fallbackUser);
          return;
        }
      } catch (basicError) {
        // Ignore here; will handle as failure below
      }

      throw new Error('Organizer data not found');
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
  
  // Calculate current payment amount based on payment type
  const currentPaymentAmount = paymentType === 'advance' && advanceAmount ? advanceAmount : totalAmount;
  const isAdvancePayment = paymentType === 'advance' && advanceAmount && remainingAmount;

  const apiOrigin = (API_BASE_URL || '').replace(/\/$/, '');
  const resolveUrl = (p: any): string => {
    if (!p) return '';
    let s = typeof p === 'string' ? p : (p.path || p.url || '');
    if (!s) return '';
    if (/^https?:\/\//i.test(s)) {
      // Replace localhost with API origin to avoid mixed content
      return s.replace(/^http:\/\/(localhost|127\.0\.0\.1):\d+/i, apiOrigin);
    }
    if (s.startsWith('/')) return `${apiOrigin}${s}`;
    return `${apiOrigin}/${s}`;
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          {isAdvancePayment ? 'Advance Payment Required' : 'Payment Instructions'}
        </h2>
        <p className="text-gray-600">
          {isAdvancePayment 
            ? `Please make the advance payment to secure your booking for ${tripTitle}` 
            : `Please make payment to complete your booking for ${tripTitle}`
          }
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
          <p className="text-sm text-blue-600 mb-1">
            {isAdvancePayment ? 'Advance Payment Amount' : 'Payment Amount'}
          </p>
          <p className="text-3xl font-bold text-blue-900">₹{currentPaymentAmount.toLocaleString()}</p>
          {isAdvancePayment && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-blue-700">
                Total Trip Amount: ₹{totalAmount.toLocaleString()}
              </p>
              <p className="text-xs text-blue-700">
                Remaining Balance: ₹{remainingAmount!.toLocaleString()}
              </p>
              <p className="text-xs text-blue-600 font-medium">
                (Balance due before trip starts)
              </p>
            </div>
          )}
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
                    src={resolveUrl(qrCode.path)}
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
                    Amount: ₹{currentPaymentAmount.toLocaleString()}
                    {isAdvancePayment && <span className="block text-xs text-blue-600">(Advance Payment)</span>}
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
              src={resolveUrl(organizerData.organizerProfile.paymentQR)}
              alt="Payment QR Code"
              className="w-48 h-48 mx-auto rounded-lg shadow-sm border"
            />
            <p className="text-sm text-gray-600 mt-3">
              Amount: ₹{currentPaymentAmount.toLocaleString()}
              {isAdvancePayment && <span className="block text-xs text-blue-600">(Advance Payment)</span>}
            </p>
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
          <li>2. Enter the exact amount: <strong>₹{currentPaymentAmount.toLocaleString()}</strong>
            {isAdvancePayment && <span className="block text-xs text-green-600 ml-4">(This is advance payment - balance due later)</span>}
          </li>
          <li>3. Add your name or booking reference in the payment note</li>
          <li>4. Complete the payment</li>
          <li>5. Take a screenshot of the payment confirmation</li>
          <li>6. Upload the screenshot below to {isAdvancePayment ? 'secure your booking' : 'confirm your booking'}</li>
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
