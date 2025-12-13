import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Plan {
  id: 'STARTER' | 'BASIC' | 'PROFESSIONAL' | 'PREMIUM' | 'ENTERPRISE';
  name: string;
  price: number;
  trips: number;
  features: string[];
  description?: string;
  trialDays?: number;
}

const loadRazorpay = () => {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => reject(new Error('Failed to load Razorpay'));
    document.body.appendChild(script);
  });
};

const Subscribe: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<Plan['id']>('PROFESSIONAL');
  const [loading, setLoading] = useState(false);
  const [loadingState, setLoadingState] = useState(true);
  const [status, setStatus] = useState('');
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/subscribe' } } });
      return;
    }

    const fetchData = async () => {
      try {
        const [plansRes, subRes] = await Promise.all([
          api.get('/api/subscriptions/plans'),
          api.get('/api/subscriptions/my'),
        ]);
        setPlans(plansRes.data?.plans || []);
        setSubscription(subRes.data);
        const existingPlan = subRes.data?.subscription?.plan;
        if (existingPlan) {
          const normalized = existingPlan.toString().toUpperCase();
          if (['STARTER', 'BASIC', 'PROFESSIONAL', 'PREMIUM', 'ENTERPRISE'].includes(normalized)) {
            setSelectedPlan(normalized as Plan['id']);
          }
        }
      } catch (error: any) {
        setStatus(error.response?.data?.error || 'Failed to load subscription data');
      } finally {
        setLoadingState(false);
      }
    };

    fetchData();
  }, [user, navigate]);

  const hasActiveSub = Boolean(subscription?.hasSubscription && subscription?.subscription?.isActive);

  const startSubscription = async () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/subscribe' } } });
      return;
    }

    if (hasActiveSub) {
      navigate('/organizer/route-onboarding');
      return;
    }

    setLoading(true);
    setStatus('');

    try {
      const { data } = await api.post('/api/subscriptions/create-order', {
        planType: selectedPlan,
      });

      if (data.isTrial) {
        setSubscription({ hasSubscription: true, subscription: data.subscription });
        setStatus(data.message || 'Trial activated');
        setTimeout(() => navigate('/organizer/route-onboarding'), 800);
        return;
      }

      await loadRazorpay();

      const options = {
        key: data.keyId,
        amount: data.amount,
        currency: data.currency,
        name: 'TrekTribe Organizer',
        description: `${data.plan?.name || 'Organizer Subscription'}`,
        order_id: data.orderId,
        handler: async (response: any) => {
          try {
            const verifyRes = await api.post('/api/subscriptions/verify-payment', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planType: selectedPlan,
            });
            setSubscription({ hasSubscription: true, subscription: verifyRes.data?.subscription });
            setStatus(verifyRes.data?.message || 'Subscription activated');
            setTimeout(() => navigate('/organizer/route-onboarding'), 800);
          } catch (err: any) {
            setStatus(err.response?.data?.error || 'Verification failed');
          }
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: (user as any).phone || '',
        },
        notes: {
          planType: selectedPlan,
          userId: user.id,
        },
        theme: { color: '#0f766e' },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', (resp: any) => {
        setStatus(resp.error?.description || 'Payment failed');
      });
      rzp.open();
    } catch (error: any) {
      setStatus(error.response?.data?.error || 'Failed to start subscription');
    } finally {
      setLoading(false);
    }
  };

  if (loadingState) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-forest-50">
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mx-auto" />
          <p className="text-forest-700 font-medium">Preparing subscription options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10 space-y-8">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 sm:p-8 rounded-3xl shadow-xl">
        <p className="text-sm uppercase font-semibold tracking-wide">Organizer Program</p>
        <h1 className="text-3xl sm:text-4xl font-bold mt-2">Subscribe to unlock organizer tools</h1>
        <p className="text-emerald-50 mt-2 max-w-3xl">Access listings, CRM, Route onboarding, and settlements with an active organizer subscription. Payments auto-split via Razorpay Route.</p>
        <div className="flex flex-wrap items-center gap-3 mt-4 text-sm text-emerald-50/90">
          <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20">Includes free trial where eligible</span>
          <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20">Auto payouts to your bank</span>
          <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20">Route onboarding required after payment</span>
        </div>
      </div>

      {hasActiveSub && (
        <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-900 flex items-center justify-between gap-3">
          <div>
            <p className="font-semibold">You already have an active subscription.</p>
            <p className="text-sm">Head to onboarding to connect Razorpay Route and start receiving payouts.</p>
          </div>
          <button
            onClick={() => navigate('/organizer/route-onboarding')}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
          >
            Go to Onboarding
          </button>
        </div>
      )}

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {plans.map((plan) => {
          const selected = plan.id === selectedPlan;
          return (
            <button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`text-left p-5 rounded-2xl border transition shadow-sm hover:shadow-md ${selected ? 'border-emerald-500 ring-2 ring-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'}`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase text-gray-500 font-semibold">{plan.id}</p>
                  <h3 className="text-xl font-bold text-gray-900">{plan.name}</h3>
                </div>
                {selected && <span className="px-3 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800">Selected</span>}
              </div>
              <p className="text-3xl font-bold text-gray-900 mt-2">₹{plan.price}<span className="text-base text-gray-500 font-medium">/mo</span></p>
              <p className="text-sm text-gray-600 mt-1">{plan.description}</p>
              <p className="text-sm text-gray-800 mt-2 font-semibold">Up to {plan.trips} trips</p>
              <ul className="mt-3 space-y-1 text-sm text-gray-700">
                {plan.features.slice(0, 4).map((f) => (
                  <li key={f}>• {f}</li>
                ))}
                {plan.features.length > 4 && <li className="text-gray-500">+ more</li>}
              </ul>
              {plan.trialDays ? (
                <p className="mt-3 text-sm text-emerald-700 font-semibold">{plan.trialDays}-day trial available</p>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="p-5 rounded-2xl border border-gray-200 bg-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="font-semibold text-gray-900">Start with the selected plan</p>
          <p className="text-sm text-gray-600">We will redirect you to Razorpay Checkout. On success, you will be sent to Route onboarding.</p>
          {status && <p className="text-sm text-emerald-700 mt-1">{status}</p>}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/join-the-tribe')}
            className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50"
          >
            Learn more
          </button>
          <button
            onClick={startSubscription}
            disabled={loading}
            className="px-5 py-3 rounded-xl bg-emerald-600 text-white font-semibold shadow hover:bg-emerald-700 disabled:opacity-60"
          >
            {loading ? 'Starting...' : hasActiveSub ? 'Go to Onboarding' : 'Subscribe & Continue'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Subscribe;
