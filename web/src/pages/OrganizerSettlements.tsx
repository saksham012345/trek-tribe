import React, { useEffect, useState } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';

type Transfer = {
  transferId?: string;
  paymentId: string;
  status: string;
  payoutAmount: number;
  createdAt: string;
};

type Ledger = {
  type: string;
  source: string;
  referenceId?: string;
  amount: number;
  currency: string;
  description?: string;
  createdAt: string;
};

const OrganizerSettlements: React.FC = () => {
  const { user } = useAuth();
  const { add } = useToast();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [ledger, setLedger] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data } = await api.get('/api/marketplace/organizer/settlements');
      setTransfers(data.transfers || []);
      setLedger(data.ledger || []);
    } catch (error) {
      console.error('Failed to load settlements', error);
      add('Failed to load settlements', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!user) return <div className="p-8">Login required.</div>;

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold">Settlements & Payouts</h1>
        <button onClick={fetchData} className="rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-semibold shadow-md hover:bg-emerald-700 hover:shadow-lg disabled:opacity-50 transition-all duration-200" disabled={loading}>
          Refresh
        </button>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Recent Transfers</h2>
        <div className="overflow-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Transfer ID</th>
                <th className="p-2 text-left">Payment</th>
                <th className="p-2">Status</th>
                <th className="p-2 text-right">Payout (₹)</th>
                <th className="p-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="p-2" colSpan={5}>
                    <div className="grid grid-cols-5 gap-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && transfers.map((t) => (
                <tr key={t.paymentId} className="border-t">
                  <td className="p-2">{t.transferId || '—'}</td>
                  <td className="p-2">{t.paymentId}</td>
                  <td className="p-2">{t.status}</td>
                  <td className="p-2 text-right">{(t.payoutAmount / 100).toFixed(2)}</td>
                  <td className="p-2">{new Date(t.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!loading && !transfers.length && (
                <tr><td className="p-3 text-center text-gray-500" colSpan={5}>No transfers yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-2">Ledger</h2>
        <div className="overflow-auto rounded border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-2 text-left">Type</th>
                <th className="p-2 text-left">Source</th>
                <th className="p-2 text-left">Reference</th>
                <th className="p-2 text-right">Amount (₹)</th>
                <th className="p-2 text-left">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="p-2" colSpan={5}>
                    <div className="grid grid-cols-5 gap-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && ledger.map((l, idx) => (
                <tr key={idx} className="border-t">
                  <td className="p-2 capitalize">{l.type}</td>
                  <td className="p-2 capitalize">{l.source}</td>
                  <td className="p-2">{l.referenceId || '—'}</td>
                  <td className="p-2 text-right">{(l.amount / 100).toFixed(2)}</td>
                  <td className="p-2">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {!loading && !ledger.length && (
                <tr><td className="p-3 text-center text-gray-500" colSpan={5}>No ledger entries yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default OrganizerSettlements;
