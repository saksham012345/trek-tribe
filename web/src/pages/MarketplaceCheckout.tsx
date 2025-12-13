import React, { useEffect, useState } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';

declare global {
  interface Window {
    Razorpay: any;
  }
}

const loadRazorpay = () => {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => reject('Razorpay SDK failed to load');
    document.body.appendChild(script);
  });
};

const MarketplaceCheckout: React.FC = () => {
  const { user } = useAuth();
  const [organizerId, setOrganizerId] = useState('');
  const [tripId, setTripId] = useState('');
  const [amount, setAmount] = useState(10000); // default ₹100
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadRazorpay().catch((err) => console.error(err));
  }, []);

  async function startCheckout() {
    if (!user) {
      setMessage('Login required');
      return;
    }
    if (!organizerId || organizerId.length < 12) {
      setMessage('Please enter a valid organizer ID');
      return;
    }
    if (amount < 100) {
      setMessage('Amount must be at least ₹1.00');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const { data } = await api.post('/api/marketplace/orders/create', {
        amount,
        organizerId,
        tripId,
        notes: { type: 'marketplace', userId: user.id },
      });

      const order = data.order;
      const keyId = process.env.REACT_APP_RAZORPAY_KEY_ID || '';
      if (!keyId) {
        setMessage('Payment key missing. Contact support.');
        return;
      }

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: 'TrekTribe Marketplace',
        description: 'Trip booking payment',
        handler: function (response: any) {
          setMessage('Payment successful. Awaiting confirmation.');
        },
        prefill: {
          name: user.name,
          email: user.email,
          contact: user.phone,
        },
        notes: order.notes,
        theme: { color: '#0f766e' },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (resp: any) {
        setMessage(resp.error?.description || 'Payment failed');
      });
      rzp.open();
    } catch (error: any) {
      setMessage(error.response?.data?.error || error.message);
    } finally {
      setLoading(false);
    }
  }

  if (!user) return <div className="p-8">Login required.</div>;

  return (
    <div className="max-w-xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Marketplace Checkout</h1>
      <p className="text-gray-600 mb-6">Pay with Razorpay. Funds will be auto-split between TrekTribe and the organizer.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Organizer ID</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={organizerId}
            onChange={(e) => setOrganizerId(e.target.value)}
            placeholder="Organizer user id"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Trip ID (optional)</label>
          <input
            className="w-full rounded border px-3 py-2"
            value={tripId}
            onChange={(e) => setTripId(e.target.value)}
            placeholder="Trip id"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Amount (paise)</label>
          <input
            type="number"
            className="w-full rounded border px-3 py-2"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            min={100}
          />
          <p className="text-xs text-gray-500">₹{(amount / 100).toFixed(2)}</p>
        </div>
        <button
          className="w-full rounded bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          onClick={startCheckout}
          disabled={loading}
        >
          {loading ? 'Creating order...' : 'Pay with Razorpay'}
        </button>
        {message && <p className="text-sm text-gray-700">{message}</p>}
      </div>
    </div>
  );
};

export default MarketplaceCheckout;
