import React, { useState } from 'react';

/**
 * UpdatePaymentMethod
 * This component provides a stub for secure payment method re-collection.
 * In production, you should use a PCI-compliant tokenization flow (e.g., Razorpay
 * Checkout, Stripe Elements). This component demonstrates sending a request to
 * open a server-side re-collection URL or tokenization session.
 */
export default function UpdatePaymentMethod() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function startUpdate() {
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      // Request a payment re-collection / tokenization session from the backend
      const res = await fetch('/api/crm/payment-recollect', { method: 'POST' });
      if (!res.ok) throw new Error('Failed to start payment update');
      const data = await res.json();
      // Backend may return a hosted-checkout url; open it in a new tab
      if (data && data.checkoutUrl) {
        window.open(data.checkoutUrl, '_blank', 'noopener');
        setMessage('Opened checkout in a new tab. Complete the flow and return.');
      } else {
        setMessage('Started payment update. Follow server instructions.');
      }
    } catch (e: any) {
      console.error(e);
      setError('Error starting payment update. You may not have access or the server is down.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p>To update the organizer's payment method, start the secure tokenization flow.</p>
      <div>
        <button onClick={startUpdate} disabled={loading}>{loading ? 'Starting...' : 'Update Payment Method'}</button>
      </div>
      {error && <div style={{ marginTop: 8, color: 'red' }}>{error}</div>}
      {message && <div style={{ marginTop: 8 }}>{message}</div>}
    </div>
  );
}
