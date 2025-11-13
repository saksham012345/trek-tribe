import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { useToast, ToastContainer } from '../components/Toast';

interface AutoPayStatus {
  isSetup: boolean;
  scheduledPaymentDate?: string;
  daysUntilPayment?: number;
  subscriptionActive?: boolean;
  amount: number;
  listingsIncluded: number;
}

const AutoPaySetup: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useAuth();
  const { toasts, success, error: showErrorToast, removeToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState(true);
  const [autoPayStatus, setAutoPayStatus] = useState<AutoPayStatus | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);

  // Redirect non-organizers
  useEffect(() => {
    if (user && user.role !== 'organizer') {
      navigate('/');
    }
  }, [user, navigate]);

  // Fetch auto-pay status
  useEffect(() => {
    fetchAutoPayStatus();
  }, []);

  const fetchAutoPayStatus = async () => {
    try {
      const response = await api.get('/api/auto-pay/status');
      setAutoPayStatus(response.data);
      
      // If already setup, redirect to dashboard
      if (response.data.isSetup) {
        navigate('/organizer-dashboard', { replace: true });
      }
    } catch (error: any) {
      console.error('Failed to fetch auto-pay status:', error);
    } finally {
      setFetchingStatus(false);
    }
  };

  const handleSetupAutoPay = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptTerms) {
      showErrorToast('Please accept the terms and conditions');
      return;
    }

    setLoading(true);

    try {
      // In production, integrate with Razorpay for payment method setup
      const response = await api.post('/api/auto-pay/setup', {
        paymentMethod: paymentMethod || 'razorpay'
      });

      success('Auto-pay setup successful!');
      
      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }

      // Redirect to dashboard after short delay
      setTimeout(() => {
        navigate('/organizer-dashboard', { replace: true });
      }, 1500);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to setup auto-pay';
      showErrorToast(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSkipForNow = () => {
    // Allow skip but warn user
    if (window.confirm('Auto-pay is required to keep your listings active. You can set it up later from your dashboard. Continue?')) {
      navigate('/organizer-dashboard');
    }
  };

  if (fetchingStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-50 via-nature-50 to-forest-100">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-forest-600 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="mt-4 text-forest-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-50 via-nature-50 to-forest-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto h-20 w-20 bg-gradient-to-br from-forest-600 to-nature-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-forest-900">
              Setup Auto-Pay Subscription
            </h2>
            <p className="mt-2 text-sm text-forest-600">
              Keep your trek listings active with our hassle-free auto-pay system
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl shadow-md p-6 border-2 border-forest-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-nature-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-nature-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-forest-900">Subscription Cost</h3>
                  <p className="text-2xl font-bold text-nature-600">₹1,499</p>
                </div>
              </div>
              <p className="text-sm text-forest-600">Per 60 days • 5 trip listings included</p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 border-2 border-forest-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-forest-900">First Payment</h3>
                  <p className="text-2xl font-bold text-blue-600">60 Days</p>
                </div>
              </div>
              <p className="text-sm text-forest-600">From your first login • Then auto-renews</p>
            </div>
          </div>

          {/* Benefits Section */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-lg font-bold text-forest-900 mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-nature-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              What's Included
            </h3>
            
            <ul className="space-y-3">
              {[
                'List up to 5 active trek trips simultaneously',
                'Automatic billing every 60 days - no manual renewals',
                'Email reminders 7 & 3 days before payment',
                'Cancel anytime with no penalties',
                'Access to organizer dashboard and analytics',
                'Priority customer support'
              ].map((benefit, index) => (
                <li key={index} className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-nature-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-forest-700">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Setup Form */}
          <form onSubmit={handleSetupAutoPay} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            <h3 className="text-lg font-bold text-forest-900 mb-4">Setup Payment Method</h3>

            {/* Payment Method Selection */}
            <div>
              <label className="block text-sm font-semibold text-forest-700 mb-3">
                Select Payment Method
              </label>
              <div className="space-y-3">
                <label className="flex items-center gap-3 p-4 border-2 border-forest-300 rounded-xl cursor-pointer hover:border-nature-500 transition-colors">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="razorpay"
                    checked={paymentMethod === 'razorpay' || !paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-5 h-5 text-nature-600"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-forest-900">Razorpay</div>
                    <div className="text-xs text-forest-600">Credit/Debit Card, UPI, Net Banking</div>
                  </div>
                  <img src="https://razorpay.com/assets/razorpay-glyph.svg" alt="Razorpay" className="h-8" />
                </label>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">How it works:</p>
                <p>After clicking "Setup Auto-Pay", you'll be redirected to our secure payment partner to add your payment method. Your first payment will be automatically charged 60 days from today.</p>
              </div>
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="w-5 h-5 text-nature-600 mt-0.5 rounded"
                  required
                />
                <span className="text-sm text-forest-700">
                  I agree to the{' '}
                  <a href="/terms" target="_blank" className="text-nature-600 hover:text-nature-700 font-medium underline">
                    Terms & Conditions
                  </a>
                  {' '}and authorize TrekTribe to charge ₹1,499 every 60 days starting from 60 days after signup. I understand I can cancel anytime.
                </span>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading || !acceptTerms}
                className="flex-1 py-3.5 px-4 bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold rounded-xl hover:from-forest-700 hover:to-nature-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Setting up...
                  </span>
                ) : (
                  'Setup Auto-Pay'
                )}
              </button>
              
              <button
                type="button"
                onClick={handleSkipForNow}
                className="sm:w-32 py-3.5 px-4 bg-white text-forest-700 font-semibold rounded-xl border-2 border-forest-300 hover:bg-forest-50 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 transition-all"
              >
                Skip for Now
              </button>
            </div>

            {/* Warning */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-yellow-800">
                  <span className="font-semibold">Important:</span> Your trip listings will be automatically deactivated if auto-pay is not set up before your 60-day trial ends.
                </p>
              </div>
            </div>
          </form>

          {/* Support Link */}
          <div className="text-center">
            <p className="text-xs text-forest-500">
              Questions about billing?{' '}
              <a href="/support" className="text-nature-600 hover:text-nature-700 font-medium">
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default AutoPaySetup;
