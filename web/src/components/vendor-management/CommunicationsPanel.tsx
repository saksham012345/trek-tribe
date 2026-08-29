import React, { useEffect, useState, useCallback } from 'react';
import api from '../../config/api';
import { useToast } from '../ui/Toast';
import { Skeleton } from '../ui/Skeleton';
import { Vendor } from './VendorsPanel';

interface CommunicationLog {
  id: string;
  vendorId: string;
  eventType: string;
  status: 'sent' | 'failed' | 'pending';
  sentAt?: string | null;
  emailSnapshot: string;
  createdAt: string;
  vendor: Vendor;
}

const statusColor: Record<string, string> = {
  sent: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  pending: 'bg-gray-100 text-gray-800'
};

const eventLabel: Record<string, string> = {
  vendor_payment_completed: 'Payment Confirmation',
  pre_departure_reminder: 'Pre-Departure Reminder'
};

const CommunicationsPanel: React.FC = () => {
  const { add } = useToast();
  const [logs, setLogs] = useState<CommunicationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [previewLog, setPreviewLog] = useState<CommunicationLog | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/vendor-communications');
      setLogs(res.data || []);
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to load communication log', 'error');
    } finally {
      setLoading(false);
    }
  }, [add]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const resend = async (log: CommunicationLog) => {
    setResendingId(log.id);
    try {
      await api.post(`/api/vendor-communications/${log.id}/resend`);
      add('Resend queued', 'success');
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to queue resend', 'error');
    } finally {
      setResendingId(null);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm text-gray-500">{logs.length} communication{logs.length !== 1 ? 's' : ''} sent to vendors</h3>
        <button onClick={fetchLogs} className="rounded-lg bg-gray-100 px-4 py-2 text-gray-700 text-sm font-semibold hover:bg-gray-200 transition-all">
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-3 text-left font-semibold text-gray-700">Vendor</th>
              <th className="p-3 text-left font-semibold text-gray-700">Event</th>
              <th className="p-3 text-left font-semibold text-gray-700">Status</th>
              <th className="p-3 text-left font-semibold text-gray-700">Sent</th>
              <th className="p-3 text-right font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="p-3" colSpan={5}>
                <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
              </td></tr>
            )}
            {!loading && logs.map(log => (
              <tr key={log.id} className="border-t hover:bg-gray-50 transition">
                <td className="p-3 font-semibold text-gray-900">{log.vendor?.businessName || '—'}</td>
                <td className="p-3 text-gray-700">{eventLabel[log.eventType] || log.eventType}</td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor[log.status]}`}>{log.status}</span>
                </td>
                <td className="p-3 text-gray-600">{log.sentAt ? new Date(log.sentAt).toLocaleString() : '—'}</td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => setPreviewLog(log)} className="text-blue-600 hover:underline text-xs font-semibold">View</button>
                  <button
                    onClick={() => resend(log)}
                    disabled={resendingId === log.id}
                    className="text-emerald-600 hover:underline text-xs font-semibold disabled:opacity-50"
                  >
                    {resendingId === log.id ? 'Queuing...' : 'Resend'}
                  </button>
                </td>
              </tr>
            ))}
            {!loading && !logs.length && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={5}>No vendor communications yet. They're sent automatically after a payment is recorded, or 3 days before a trip departs.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {previewLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setPreviewLog(null)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Email Preview</h3>
              <button onClick={() => setPreviewLog(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="border border-gray-200 rounded p-4 bg-gray-50" dangerouslySetInnerHTML={{ __html: previewLog.emailSnapshot }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunicationsPanel;
