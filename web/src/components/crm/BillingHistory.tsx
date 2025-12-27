import React, { useEffect, useState } from 'react';

type Charge = {
  _id: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
};

/**
 * BillingHistory
 * Displays recent organizer billing transactions. Backend expected endpoint:
 * GET /api/organizer/billing
 */
export default function BillingHistory() {
  const [charges, setCharges] = useState<Charge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchCharges();
  }, []);

  async function fetchCharges() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/organizer/billing');
      if (!res.ok) throw new Error('Failed to load billing');
      const data = await res.json();
      setCharges(data || []);
    } catch (e) {
      console.error(e);
      setError('Failed to load billing history. You may not have access or the server is down.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      {error && <div className="text-red-600 mb-2">{error}</div>}
      {loading ? (
        <div>Loading billing history...</div>
      ) : (
        <table style={{ width: '100%' }}>
          <thead>
            <tr>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {charges.map(c => (
              <tr key={c._id}>
                <td>{new Date(c.createdAt).toLocaleString()}</td>
                <td>{c.amount} {c.currency}</td>
                <td>{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
