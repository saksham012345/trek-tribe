import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { useToast, ToastContainer } from '../components/Toast';

interface Plan {
  type: string;
  name: string;
  price: number;
  trips: number;
  description: string;
  crmAccess: boolean;
  leadCapture: boolean;
  phoneNumbers: boolean;
  features: string[];
  popular?: boolean;
}

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
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [autoPayStatus, setAutoPayStatus] = useState<AutoPayStatus | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>('PROFESSIONAL');
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
    fetchPlans();
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

  const fetchPlans = async () => {
    try {
      const response = await api.get('/api/subscriptions/plans');
      setPlans(response.data.plans || []);
      // Set PROFESSIONAL as default if available
      const proPlans = response.data.plans?.filter((p: Plan) => p.type === 'PROFESSIONAL');
      if (proPlans && proPlans.length > 0) {
        setSelectedPlan('PROFESSIONAL');
      } else if (response.data.plans && response.data.plans.length > 0) {
        setSelectedPlan(response.data.plans[0].type);
      }
    } catch (error: any) {
      console.error('Failed to fetch plans:', error);
      showErrorToast('Failed to load subscription plans');
    } finally {
      setLoadingPlans(false);
    }
  };

  const handleSetupAutoPay = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptTerms) {
      showErrorToast('Please accept the terms and conditions');
      return;
    }

    if (!paymentMethod || paymentMethod !== 'razorpay') {
      showErrorToast('Please select a payment method');
      return;
    }

    if (!selectedPlan) {
      showErrorToast('Please select a subscription plan');
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create order on backend
      console.log('📝 Creating Razorpay order for plan:', selectedPlan);
      const orderResponse = await api.post('/api/subscriptions/create-order', {
        planType: selectedPlan,
        skipTrial: false,
      });

      if (!orderResponse.data.success) {
        throw new Error('Failed to create order');
      }

      const { order, keyId } = orderResponse.data;

      if (!order || !order.id) {
        throw new Error('Invalid order data received');
      }

      console.log('✅ Order created:', order.id);

      // Step 2: Check if Razorpay is available
      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) {
        throw new Error('Razorpay is not loaded. Please refresh the page and try again.');
      }

      // Step 3: Open Razorpay checkout modal
      console.log('🔓 Opening Razorpay checkout modal...');
      
      const options = {
        key: keyId,
        amount: order.amount, // Amount in paise (₹1499 = 149900 paise)
        currency: order.currency,
        order_id: order.id,
        name: 'TrekTribe',
        description: `${selectedPlan} Plan Subscription`,
        image: '/logo-192x192.png',
        handler: async (response: any) => {
          try {
            console.log('✅ Payment successful! Verifying...');
            console.log('Payment ID:', response.razorpay_payment_id);

            // Step 4: Verify payment on backend
            const verifyResponse = await api.post('/api/subscriptions/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planType: selectedPlan,
            });

            if (verifyResponse.data.success) {
              console.log('✅ Payment verified successfully');
              success('Payment successful! Your subscription is now active.');
              
              // Refresh user data
              if (refreshUser) {
                await refreshUser();
              }

              // Redirect to dashboard
              setTimeout(() => {
                navigate('/organizer-dashboard', { replace: true });
              }, 2000);
            } else {
              throw new Error('Payment verification failed');
            }
          } catch (verifyError: any) {
            console.error('❌ Payment verification error:', verifyError);
            const errorMsg = verifyError.response?.data?.error || 
                           verifyError.message || 
                           'Payment verification failed. Please contact support.';
            showErrorToast(errorMsg);
            setLoading(false);
          }
        },
        prefill: {
          email: user?.email || '',
          contact: user?.phone || '',
        },
        notes: {
          userId: user?.id,
          planType: selectedPlan,
        },
        theme: {
          color: '#2d5a1e', // Forest color
        },
        timeout: 900, // 15 minutes timeout
        ondismiss: () => {
          console.log('❌ Payment modal dismissed by user');
          showErrorToast('Payment setup cancelled. Please try again.');
          setLoading(false);
        },
        // Additional security
        upi: {
          flow: 'otp',
        },
        recurring: '1', // For subscription
        totals: {
          gross_amount: order.amount,
        },
      };

      // Open modal
      const razorpay = new Razorpay(options);
      
      // Handle errors from Razorpay SDK
      razorpay.on('payment.failed', function(response: any) {
        console.error('❌ Payment failed:', response.error);
        const errorMsg = response.error?.description || 'Payment failed. Please try again.';
        showErrorToast(errorMsg);
        setLoading(false);
      });

      razorpay.open();
    } catch (error: any) {
      console.error('❌ Error in payment setup:', error);
      const errorMsg = error.response?.data?.error || 
                       error.message || 
                       'Failed to setup auto-pay. Please try again.';
      showErrorToast(errorMsg);
      setLoading(false);
    }
  };

  const handleSkipForNow = () => {
    // Allow skip but warn user
    if (window.confirm('Auto-pay is required to keep your listings active. You can set it up later from your dashboard. Continue?')) {
      navigate('/organizer-dashboard');
    }
  };

  if (fetchingStatus || loadingPlans) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-50 via-nature-50 to-forest-100">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-forest-600 mx-auto" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="mt-4 text-forest-600">Loading subscription plans...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="min-h-screen bg-gradient-to-br from-forest-50 via-nature-50 to-forest-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto h-20 w-20 bg-gradient-to-br from-forest-600 to-nature-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-forest-900">
              Choose Your Subscription Plan
            </h2>
            <p className="mt-2 text-sm text-forest-600">
              Select the perfect plan for your trek business and start listing today
            </p>
          </div>

          {/* Plans Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-4 lg:gap-3">
            {plans.map((plan) => {
              const isSelected = selectedPlan === plan.type;
              const isProfessional = plan.type === 'PROFESSIONAL';
              
              return (
                <div
                  key={plan.type}
                  onClick={() => setSelectedPlan(plan.type)}
                  className={`relative rounded-xl transition-all duration-300 cursor-pointer transform hover:scale-105 ${
                    isSelected
                      ? 'ring-2 ring-nature-600 shadow-xl scale-105'
                      : 'shadow-md hover:shadow-lg'
                  } ${
                    isSelected
                      ? 'bg-white border-2 border-nature-600'
                      : 'bg-white border-2 border-gray-200 hover:border-nature-300'
                  }`}
                >
                  {/* Popular Badge */}
                  {isProfessional && (
                    <div className="absolute -top-4 left-0 right-0 flex justify-center">
                      <div className="bg-gradient-to-r from-nature-600 to-forest-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        ⭐ MOST POPULAR
                      </div>
                    </div>
                  )}

                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute -right-2 -top-2">
                      <div className="w-8 h-8 bg-nature-600 rounded-full flex items-center justify-center shadow-lg">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}

                  <div className="p-4 lg:p-3">
                    {/* Plan Name & Price */}
                    <h3 className="font-bold text-forest-900 text-base lg:text-sm">{plan.type}</h3>
                    <p className="text-xs text-forest-600 mb-3">{plan.description}</p>
                    
                    <div className="mb-4">
                      <div className="text-2xl lg:text-xl font-bold text-nature-600">₹{plan.price}</div>
                      <p className="text-xs text-forest-600">per month</p>
                    </div>

                    {/* Trips */}
                    <div className="bg-forest-50 rounded-lg p-2 mb-3 text-center">
                      <p className="font-semibold text-forest-900 text-sm">{plan.trips} Trips</p>
                      <p className="text-xs text-forest-600">active listings</p>
                    </div>

                    {/* CRM Badge */}
                    {plan.crmAccess && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-2 mb-3">
                        <p className="text-xs font-semibold text-green-700">✨ CRM Access</p>
                      </div>
                    )}

                    {/* Key Features */}
                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <svg className="w-4 h-4 text-nature-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-xs text-forest-700">Auto-pay setup</span>
                      </div>
                      {plan.leadCapture && (
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-nature-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs text-forest-700">Lead capture</span>
                        </div>
                      )}
                      {plan.phoneNumbers && (
                        <div className="flex items-start gap-2">
                          <svg className="w-4 h-4 text-nature-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                          <span className="text-xs text-forest-700">Phone numbers</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Selected Plan Details */}
          {selectedPlan && (
            <div className="bg-white rounded-2xl shadow-xl p-8 border-2 border-nature-200">
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-forest-900 mb-2">
                  {plans.find(p => p.type === selectedPlan)?.name}
                </h3>
                <p className="text-forest-600">
                  {plans.find(p => p.type === selectedPlan)?.description}
                </p>
              </div>

              {/* All Features */}
              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h4 className="font-bold text-forest-900 mb-4">What's Included</h4>
                  <ul className="space-y-3">
                    {plans.find(p => p.type === selectedPlan)?.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <svg className="w-5 h-5 text-nature-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span className="text-sm text-forest-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Plan Summary */}
                <div className="bg-forest-50 rounded-xl p-6">
                  <h4 className="font-bold text-forest-900 mb-4">Plan Summary</h4>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-forest-700">Monthly Cost</span>
                      <span className="font-bold text-nature-600">₹{plans.find(p => p.type === selectedPlan)?.price}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-forest-700">Active Trips</span>
                      <span className="font-bold text-nature-600">{plans.find(p => p.type === selectedPlan)?.trips}</span>
                    </div>
                    {plans.find(p => p.type === selectedPlan)?.crmAccess && (
                      <div className="flex justify-between items-center">
                        <span className="text-forest-700">CRM Access</span>
                        <span className="font-bold text-green-600">✅ Included</span>
                      </div>
                    )}
                    {plans.find(p => p.type === selectedPlan)?.leadCapture && (
                      <div className="flex justify-between items-center">
                        <span className="text-forest-700">Lead Capture</span>
                        <span className="font-bold text-green-600">✅ Included</span>
                      </div>
                    )}
                    {plans.find(p => p.type === selectedPlan)?.phoneNumbers && (
                      <div className="flex justify-between items-center">
                        <span className="text-forest-700">Phone Numbers</span>
                        <span className="font-bold text-green-600">✅ Visible</span>
                      </div>
                    )}
                    <div className="pt-4 border-t border-forest-200">
                      <p className="text-xs text-forest-600 text-center">
                        First payment on the date you complete setup. Then auto-renews monthly.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method Selection */}
              <div className="mb-6">
                <h4 className="text-lg font-bold text-forest-900 mb-4">Select Payment Method</h4>
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
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3 mb-6">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">How it works:</p>
                  <p>After clicking "Complete Payment", you'll be redirected to our secure payment partner. Your first payment will be charged today, then auto-renews monthly on the same date.</p>
                </div>
              </div>

              {/* Terms & Conditions */}
              <div className="space-y-3 mb-6">
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
                    {' '}and authorize TrekTribe to charge ₹{plans.find(p => p.type === selectedPlan)?.price} monthly. I understand I can cancel anytime from my dashboard.
                  </span>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleSetupAutoPay}
                  disabled={loading || !acceptTerms}
                  className="flex-1 py-3.5 px-4 bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold rounded-xl hover:from-forest-700 hover:to-nature-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Processing...
                    </span>
                  ) : (
                    `Complete Payment - ₹${plans.find(p => p.type === selectedPlan)?.price}`
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => navigate('/organizer-dashboard')}
                  className="sm:w-32 py-3.5 px-4 bg-white text-forest-700 font-semibold rounded-xl border-2 border-forest-300 hover:bg-forest-50 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 transition-all"
                >
                  Skip for Now
                </button>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-6">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-sm text-yellow-800">
                    <span className="font-semibold">Important:</span> Your trip listings will be automatically deactivated if subscription is not set up. You can always reactivate by setting up auto-pay.
                  </p>
                </div>
              </div>
            </div>
          )}

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
