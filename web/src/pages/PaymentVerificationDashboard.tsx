import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../services/apiClient';
import { useToast, ToastContainer } from '../components/Toast';
import { Skeleton } from '../components/ui/Skeleton';

interface PaymentVerification {
  verificationCode: string;
  qrCodeUrl: string;
  expiresAt: string;
  totalVerifiedAmount: number;
  verificationCount: number;
  paymentsMade: Array<{
    amount: number;
    currency: string;
    transactionId: string;
    verifiedAt: string;
    status: string;
  }>;
}

interface PaymentHistory {
  amount: number;
  currency: string;
  paymentMethod: string;
  transactionId: string;
  verifiedAt: string;
  status: string;
}

interface TrustedAmountQR {
  qrCodeUrl: string;
  referenceId: string;
  amount: number;
  currency: string;
  trusted: boolean;
}

export const PaymentVerificationDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { showToast, success, toasts, removeToast } = useToast();
  const [verification, setVerification] = useState<PaymentVerification | null>(null);
  const [history, setHistory] = useState<PaymentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQRCode, setShowQRCode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [trustedQR, setTrustedQR] = useState<TrustedAmountQR | null>(null);
  const [trustedAmount, setTrustedAmount] = useState('');
  const [trustedPurpose, setTrustedPurpose] = useState('');
  const [qrGenerating, setQrGenerating] = useState(false);

  useEffect(() => {
    checkAuthorization();
    fetchVerificationCode();
    fetchPaymentHistory();
  }, []); 

  const checkAuthorization = async () => {
    try {
      const response = await apiClient.get('/subscriptions/verify-crm-access');
      if (!response.data.hasCRMAccess) {
        showToast('You need a CRM-enabled subscription to access payment verification', 'error');
        navigate('/subscribe');
      }
    } catch (error) {
      console.error('Authorization check failed:', error);
    }
  };

  const fetchVerificationCode = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/payment-verification/active-code');
      setVerification(response.data);
    } catch (error: any) {
      if (error.response?.status === 404) {
        // No active verification code, that's fine
      } else {
        console.error('Error fetching verification code:', error);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const response = await apiClient.get('/payment-verification/history');
      setHistory(response.data.history || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    }
  };

  const handleGenerateCode = async () => {
    try {
      const response = await apiClient.post('/payment-verification/generate-code', {});
      setVerification(response.data);
      showToast('Payment verification code generated successfully!', 'success');
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to generate verification code', 'error');
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm('Are you sure you want to deactivate this verification code? You will need to generate a new one.')) {
      return;
    }

    try {
      await apiClient.post('/payment-verification/deactivate', {});
      setVerification(null);
      showToast('Verification code deactivated', 'success');
      fetchVerificationCode();
    } catch (error: any) {
      showToast(error.response?.data?.message || 'Failed to deactivate verification code', 'error');
    }
  };

  const handleCopyCode = () => {
    if (verification?.verificationCode) {
      navigator.clipboard.writeText(verification.verificationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Code copied to clipboard!', 'success');
    }
  };

  const handleGenerateTrustedQR = async () => {
    try {
      setQrGenerating(true);
      const amount = parseFloat(trustedAmount || '0');
      if (!amount || amount <= 0) {
        throw new Error('Enter a valid amount');
      }

      const response = await apiClient.post('/payment-verification/generate-amount-qr', {
        amount,
        currency: 'INR',
        purpose: trustedPurpose || 'Trip payment',
      });

      const data = response.data as any;
      setTrustedQR({
        qrCodeUrl: data?.qrCodeUrl,
        referenceId: data?.referenceId,
        amount,
        currency: (data?.payload?.currency as string) || 'INR',
        trusted: true,
      });
      success('Trusted QR generated');
    } catch (error: any) {
      showToast(error?.response?.data?.error || error.message || 'Failed to generate trusted QR', 'error');
    } finally {
      setQrGenerating(false);
    }
  };

  const handleDownloadQR = () => {
    if (verification?.qrCodeUrl) {
      const link = document.createElement('a');
      link.href = verification.qrCodeUrl;
      link.download = `payment-verification-qr-${Date.now()}.png`;
      link.click();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
          <div className="grid lg:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-6">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="mt-2 h-6 w-52" />
                <Skeleton className="mt-3 h-24 w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payment Verification</h1>
          <p className="mt-2 text-gray-600">
            Manage QR codes for customer payment verification. Share your QR code with customers to verify payments received.
          </p>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* QR Code Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-md p-8">
              {!verification ? (
                <div className="text-center py-12">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">No Active Verification Code</h2>
                  <p className="text-gray-600 mb-6">
                    Generate a new QR code to start verifying customer payments.
                  </p>
                  <button
                    onClick={handleGenerateCode}
                    className="inline-flex items-center px-6 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Generate Verification Code
                  </button>
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">Your QR Code</h2>
                    <button
                      onClick={handleDeactivate}
                      className="text-red-600 hover:text-red-700 font-medium text-sm"
                    >
                      Deactivate
                    </button>
                  </div>

                  {/* Trusted Razorpay-style QR generator */}
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold text-green-800">Trusted QR (Automated)</p>
                        <p className="text-xs text-green-700">Generates an exact-amount QR (Razorpay-style payload).</p>
                      </div>
                      <button
                        onClick={handleGenerateTrustedQR}
                        disabled={qrGenerating}
                        className="px-3 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-60"
                      >
                        {qrGenerating ? 'Generating...' : 'Generate QR'}
                      </button>
                    </div>
                    <div className="grid sm:grid-cols-3 gap-3">
                      <input
                        type="number"
                        min="1"
                        placeholder="Amount (₹)"
                        value={trustedAmount}
                        onChange={(e) => setTrustedAmount(e.target.value)}
                        className="px-3 py-2 border border-green-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                      />
                      <input
                        type="text"
                        placeholder="Purpose (optional)"
                        value={trustedPurpose}
                        onChange={(e) => setTrustedPurpose(e.target.value)}
                        className="px-3 py-2 border border-green-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-400 sm:col-span-2"
                      />
                    </div>
                    {trustedQR && trustedQR.qrCodeUrl && (
                      <div className="flex items-center gap-4 mt-4">
                        <img src={trustedQR.qrCodeUrl} alt="Trusted QR" className="w-28 h-28 border border-green-200 rounded-lg" />
                        <div className="text-sm text-green-800">
                          <p>Amount: ₹{trustedQR.amount} {trustedQR.currency}</p>
                          <p>Reference: {trustedQR.referenceId}</p>
                          <p className="text-green-700">Automated & trusted</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* QR Code Display */}
                  <div className="bg-gray-50 rounded-lg p-6 mb-6 flex flex-col items-center">
                    {showQRCode && verification.qrCodeUrl ? (
                      <img
                        src={verification.qrCodeUrl}
                        alt="Payment Verification QR Code"
                        className="w-64 h-64 border-2 border-gray-200 rounded-lg"
                      />
                    ) : (
                      <div className="w-64 h-64 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-gray-400">
                        QR Code hidden (click Show to display)
                      </div>
                    )}
                    <button
                      onClick={() => setShowQRCode(!showQRCode)}
                      className="mt-4 text-blue-600 hover:text-blue-700 font-medium text-sm"
                    >
                      {showQRCode ? 'Hide' : 'Show'} QR Code
                    </button>
                  </div>

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    <button
                      onClick={handleDownloadQR}
                      className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      Download QR
                    </button>
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      {copied ? 'Copied!' : 'Copy Code'}
                    </button>
                  </div>

                  {/* Verification Code Info */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zm-11-1a1 1 0 11-2 0 1 1 0 012 0zM8 9a1 1 0 100-2 1 1 0 000 2zm5-1a1 1 0 11-2 0 1 1 0 012 0z" clipRule="evenodd" />
                      </svg>
                      <div>
                        <h3 className="font-semibold text-blue-900 mb-1">Verification Code</h3>
                        <p className="text-blue-700 font-mono text-sm mb-2">{verification.verificationCode}</p>
                        <p className="text-xs text-blue-600">
                          Expires on {new Date(verification.expiresAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Stats Section */}
          <div className="lg:col-span-1">
            {verification && (
              <div className="space-y-4">
                {/* Total Verified Amount */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-md p-6 border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-green-700 font-medium text-sm">Total Verified</p>
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-green-900">
                    ₹{verification.totalVerifiedAmount.toLocaleString()}
                  </p>
                </div>

                {/* Verification Count */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-6 border border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-blue-700 font-medium text-sm">Verifications</p>
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{verification.verificationCount}</p>
                </div>

                {/* Status */}
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-md p-6 border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-purple-700 font-medium text-sm">Status</p>
                    <svg className="w-6 h-6 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" />
                    </svg>
                  </div>
                  <p className="text-lg font-bold text-purple-900">Active</p>
                  <p className="text-xs text-purple-600 mt-2">
                    Expires {new Date(verification.expiresAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Payment History */}
        <div className="mt-8">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Verified Payments</h2>
            </div>
            {history.length === 0 ? (
              <div className="px-6 py-12 text-center">
                <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-gray-500">No verified payments yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Transaction ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {history.map((payment, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          ₹{payment.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {payment.paymentMethod}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-600">
                          {payment.transactionId.substring(0, 12)}...
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {new Date(payment.verifiedAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Verified
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentVerificationDashboard;
