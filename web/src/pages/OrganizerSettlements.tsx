import React, { useEffect, useState, useMemo } from 'react';
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
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0]
  });

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

  // Calculate summary metrics
  const metrics = useMemo(() => {
    const totalPayout = transfers.reduce((sum, t) => sum + (t.payoutAmount || 0), 0);
    const totalCredits = ledger
      .filter(l => l.type === 'credit')
      .reduce((sum, l) => sum + (l.amount || 0), 0);
    const totalDebits = ledger
      .filter(l => l.type === 'debit')
      .reduce((sum, l) => sum + (l.amount || 0), 0);
    const currentBalance = totalCredits - totalDebits;
    const processedCount = transfers.filter(t => t.status === 'processed').length;
    const pendingCount = transfers.filter(t => t.status === 'pending' || t.status === 'initiated').length;

    return {
      totalPayout,
      totalCredits,
      totalDebits,
      currentBalance,
      processedCount,
      pendingCount
    };
  }, [transfers, ledger]);

  // Filter transfers by status and date
  const filteredTransfers = useMemo(() => {
    return transfers.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      const date = new Date(t.createdAt);
      const from = new Date(dateRange.from);
      const to = new Date(dateRange.to);
      to.setHours(23, 59, 59, 999);
      return date >= from && date <= to;
    });
  }, [transfers, statusFilter, dateRange]);

  // Export as CSV
  const exportCSV = () => {
    const headers = ['Transfer ID', 'Payment', 'Status', 'Payout (₹)', 'Created'];
    const rows = filteredTransfers.map(t => [
      t.transferId || '—',
      t.paymentId,
      t.status,
      (t.payoutAmount / 100).toFixed(2),
      new Date(t.createdAt).toLocaleString()
    ]);
    const csv = [headers, ...rows].map(r => r.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `settlements-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    add('Settlements exported', 'success');
  };

  if (!user) return <div className="p-8">Login required.</div>;

  return (
    <div className="max-w-6xl mx-auto p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Settlements & Payouts</h1>
        <div className="flex gap-2">
          <button onClick={fetchData} className="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-semibold shadow-md hover:bg-blue-700 hover:shadow-lg disabled:opacity-50 transition-all duration-200" disabled={loading}>
            Refresh
          </button>
          <button onClick={exportCSV} className="rounded-lg bg-emerald-600 px-4 py-2 text-white text-sm font-semibold shadow-md hover:bg-emerald-700 hover:shadow-lg disabled:opacity-50 transition-all duration-200" disabled={loading || filteredTransfers.length === 0}>
            📥 Export CSV
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="text-sm font-medium text-blue-700">Current Balance</div>
          <div className="text-2xl font-bold text-blue-900">₹{(metrics.currentBalance / 100).toFixed(2)}</div>
          <div className="text-xs text-blue-600 mt-1">Credits - Debits</div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="text-sm font-medium text-green-700">Total Payouts</div>
          <div className="text-2xl font-bold text-green-900">₹{(metrics.totalPayout / 100).toFixed(2)}</div>
          <div className="text-xs text-green-600 mt-1">{metrics.processedCount} processed</div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
          <div className="text-sm font-medium text-orange-700">Pending Transfers</div>
          <div className="text-2xl font-bold text-orange-900">{metrics.pendingCount}</div>
          <div className="text-xs text-orange-600 mt-1">Awaiting processing</div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="text-sm font-medium text-purple-700">Total Credits</div>
          <div className="text-2xl font-bold text-purple-900">₹{(metrics.totalCredits / 100).toFixed(2)}</div>
          <div className="text-xs text-purple-600 mt-1">Ledger entries</div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex gap-4 items-end flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="initiated">Initiated</option>
            <option value="processed">Processed</option>
            <option value="failed">Failed</option>
            <option value="reversed">Reversed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="ml-auto text-sm text-gray-600">
          Showing {filteredTransfers.length} of {transfers.length} transfers
        </div>
      </div>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Recent Transfers</h2>
        <div className="overflow-auto rounded border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="p-3 text-left font-semibold text-gray-700">Transfer ID</th>
                <th className="p-3 text-left font-semibold text-gray-700">Payment</th>
                <th className="p-3 text-left font-semibold text-gray-700">Status</th>
                <th className="p-3 text-right font-semibold text-gray-700">Payout (₹)</th>
                <th className="p-3 text-left font-semibold text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="p-3" colSpan={5}>
                    <div className="grid grid-cols-5 gap-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && filteredTransfers.map((t) => (
                <tr key={t.paymentId} className="border-t hover:bg-gray-50 transition">
                  <td className="p-3 font-mono text-xs text-gray-600">{t.transferId || '—'}</td>
                  <td className="p-3 font-mono text-xs">{t.paymentId.substring(0, 10)}...</td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      t.status === 'processed' ? 'bg-green-100 text-green-800' :
                      t.status === 'pending' || t.status === 'initiated' ? 'bg-yellow-100 text-yellow-800' :
                      t.status === 'failed' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3 text-right font-semibold text-green-700">₹{(t.payoutAmount / 100).toFixed(2)}</td>
                  <td className="p-3 text-gray-600">{new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
              {!loading && !filteredTransfers.length && (
                <tr><td className="p-4 text-center text-gray-500" colSpan={5}>No transfers found for the selected filters</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Ledger</h2>
        <div className="overflow-auto rounded border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-100 border-b">
              <tr>
                <th className="p-3 text-left font-semibold text-gray-700">Type</th>
                <th className="p-3 text-left font-semibold text-gray-700">Source</th>
                <th className="p-3 text-left font-semibold text-gray-700">Reference</th>
                <th className="p-3 text-right font-semibold text-gray-700">Amount (₹)</th>
                <th className="p-3 text-left font-semibold text-gray-700">Description</th>
                <th className="p-3 text-left font-semibold text-gray-700">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td className="p-3" colSpan={6}>
                    <div className="grid grid-cols-6 gap-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-4 w-full" />
                      ))}
                    </div>
                  </td>
                </tr>
              )}
              {!loading && ledger.map((l, idx) => (
                <tr key={idx} className="border-t hover:bg-gray-50 transition">
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      l.type === 'credit' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {l.type.toUpperCase()}
                    </span>
                  </td>
                  <td className="p-3 capitalize text-gray-700">{l.source}</td>
                  <td className="p-3 font-mono text-xs text-gray-600">{l.referenceId || '—'}</td>
                  <td className={`p-3 text-right font-semibold ${l.type === 'credit' ? 'text-green-700' : 'text-red-700'}`}>
                    {l.type === 'credit' ? '+' : '-'}₹{Math.abs(l.amount / 100).toFixed(2)}
                  </td>
                  <td className="p-3 text-gray-600 text-xs">{l.description || '—'}</td>
                  <td className="p-3 text-gray-600">{new Date(l.createdAt).toLocaleDateString()} {new Date(l.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                </tr>
              ))}
              {!loading && !ledger.length && (
                <tr><td className="p-4 text-center text-gray-500" colSpan={6}>No ledger entries yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default OrganizerSettlements;
