import React, { useEffect, useState, useCallback } from 'react';
import api from '../../config/api';
import { useToast } from '../ui/Toast';
import { Skeleton } from '../ui/Skeleton';
import { VENDOR_CATEGORIES, Vendor } from './VendorsPanel';

const CATEGORY_LABELS: Record<string, string> = {
  hotel: 'Hotel', homestay: 'Homestay', campsite: 'Campsite', transport: 'Transport',
  driver: 'Driver', guide: 'Guide', trek_leader: 'Trek Leader', equipment_rental: 'Equipment Rental',
  food: 'Food', photographer: 'Photographer', videographer: 'Videographer',
  permit_agency: 'Permit Agency', emergency_contact: 'Emergency Contact', custom: 'Custom'
};

interface Trip {
  _id: string;
  title: string;
  startDate: string;
}

interface Assignment {
  id: string;
  tripId: string;
  vendorId: string;
  category: string;
  assignedAt: string;
  vendor: Vendor;
}

const AssignmentsPanel: React.FC = () => {
  const { add } = useToast();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedTripId, setSelectedTripId] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [assignVendorId, setAssignVendorId] = useState('');
  const [assignCategory, setAssignCategory] = useState('transport');
  const [assigning, setAssigning] = useState(false);
  const [paymentAssignment, setPaymentAssignment] = useState<Assignment | null>(null);

  useEffect(() => {
    (async () => {
      setLoadingTrips(true);
      try {
        const [tripsRes, vendorsRes] = await Promise.all([
          api.get('/organizer/trips'),
          api.get('/api/vendors')
        ]);
        const tripList: Trip[] = tripsRes.data?.trips || [];
        setTrips(tripList);
        setVendors(vendorsRes.data || []);
        if (tripList.length) setSelectedTripId(tripList[0]._id);
      } catch (error: any) {
        add(error?.response?.data?.error || 'Failed to load trips/vendors', 'error');
      } finally {
        setLoadingTrips(false);
      }
    })();
  }, [add]);

  const fetchAssignments = useCallback(async () => {
    if (!selectedTripId) { setAssignments([]); return; }
    setLoadingAssignments(true);
    try {
      const res = await api.get(`/api/trips/${selectedTripId}/vendors`);
      setAssignments(res.data || []);
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to load assignments', 'error');
    } finally {
      setLoadingAssignments(false);
    }
  }, [selectedTripId, add]);

  useEffect(() => { fetchAssignments(); }, [fetchAssignments]);

  const assignVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignVendorId) {
      add('Choose a vendor to assign', 'error');
      return;
    }
    setAssigning(true);
    try {
      await api.post(`/api/trips/${selectedTripId}/vendors`, { vendorId: assignVendorId, category: assignCategory });
      add('Vendor assigned to trip', 'success');
      setAssignVendorId('');
      fetchAssignments();
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to assign vendor', 'error');
    } finally {
      setAssigning(false);
    }
  };

  const unassign = async (assignment: Assignment) => {
    if (!window.confirm(`Remove ${assignment.vendor.businessName} from this trip?`)) return;
    try {
      await api.delete(`/api/trip-vendor-assignments/${assignment.id}`);
      add('Vendor unassigned', 'success');
      fetchAssignments();
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to unassign vendor', 'error');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trip</label>
          {loadingTrips ? <Skeleton className="h-9 w-64" /> : (
            <select
              value={selectedTripId}
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[16rem]"
            >
              {!trips.length && <option value="">No trips yet</option>}
              {trips.map(t => (
                <option key={t._id} value={t._id}>{t.title} ({new Date(t.startDate).toLocaleDateString()})</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {selectedTripId && (
        <>
          <form onSubmit={assignVendor} className="mb-6 p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Vendor</label>
              <select value={assignVendorId} onChange={(e) => setAssignVendorId(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-w-[14rem]">
                <option value="">Select a vendor...</option>
                {vendors.map(v => <option key={v.id} value={v.id}>{v.businessName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role on this trip</label>
              <select value={assignCategory} onChange={(e) => setAssignCategory(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
              </select>
            </div>
            <button type="submit" disabled={assigning || !vendors.length}
              className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
              {assigning ? 'Assigning...' : 'Assign to Trip'}
            </button>
            {!vendors.length && <span className="text-xs text-gray-500">Add a vendor in the Vendors tab first.</span>}
          </form>

          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-3 text-left font-semibold text-gray-700">Vendor</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Role</th>
                  <th className="p-3 text-left font-semibold text-gray-700">Assigned</th>
                  <th className="p-3 text-right font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingAssignments && (
                  <tr><td className="p-3" colSpan={4}>
                    <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
                  </td></tr>
                )}
                {!loadingAssignments && assignments.map(a => (
                  <tr key={a.id} className="border-t hover:bg-gray-50 transition">
                    <td className="p-3 font-semibold text-gray-900">{a.vendor.businessName}</td>
                    <td className="p-3 text-gray-700">{CATEGORY_LABELS[a.category] || a.category}</td>
                    <td className="p-3 text-gray-600">{new Date(a.assignedAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right space-x-2 whitespace-nowrap">
                      <button onClick={() => setPaymentAssignment(a)} className="text-emerald-600 hover:underline text-xs font-semibold">Payment</button>
                      <button onClick={() => unassign(a)} className="text-red-600 hover:underline text-xs font-semibold">Unassign</button>
                    </td>
                  </tr>
                ))}
                {!loadingAssignments && !assignments.length && (
                  <tr><td className="p-6 text-center text-gray-500" colSpan={4}>No vendors assigned to this trip yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!selectedTripId && !loadingTrips && (
        <p className="text-gray-500 text-sm">Create a trip first to assign vendors to it.</p>
      )}

      {paymentAssignment && (
        <PaymentModal assignment={paymentAssignment} onClose={() => setPaymentAssignment(null)} />
      )}
    </div>
  );
};

interface PaymentHistoryEntry {
  id: string;
  amount: string;
  paidAt: string;
  note?: string | null;
}

interface PaymentSummary {
  totalAmount: string;
  paidAmount: string;
  status: string;
  dueDate?: string | null;
  history: PaymentHistoryEntry[];
}

const statusColor: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-800',
  partial: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800'
};

const PaymentModal: React.FC<{ assignment: Assignment; onClose: () => void }> = ({ assignment, onClose }) => {
  const { add } = useToast();
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [note, setNote] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/trip-vendor-assignments/${assignment.id}/payments`);
      setSummary(res.data || null);
    } catch (error: any) {
      // 404 just means no payment recorded yet
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [assignment.id]);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  const recordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      add('Enter a valid payment amount', 'error');
      return;
    }
    if (!summary && (!totalAmount || Number(totalAmount) <= 0)) {
      add('Enter the total agreed amount for the first payment', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/api/trip-vendor-assignments/${assignment.id}/payments`, {
        amount: Number(amount),
        note: note || undefined,
        totalAmount: !summary ? Number(totalAmount) : undefined,
        dueDate: dueDate || undefined
      });
      add('Payment recorded', 'success');
      setAmount('');
      setNote('');
      fetchSummary();
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to record payment', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const outstanding = summary ? Number(summary.totalAmount) - Number(summary.paidAmount) : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{assignment.vendor.businessName} — Payment</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        {loading && <Skeleton className="h-16 w-full mb-4" />}

        {!loading && summary && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
              <div className="text-xs text-blue-700">Total</div>
              <div className="text-lg font-bold text-blue-900">₹{Number(summary.totalAmount).toLocaleString()}</div>
            </div>
            <div className="bg-green-50 rounded-lg p-3 border border-green-200">
              <div className="text-xs text-green-700">Paid</div>
              <div className="text-lg font-bold text-green-900">₹{Number(summary.paidAmount).toLocaleString()}</div>
            </div>
            <div className="bg-orange-50 rounded-lg p-3 border border-orange-200">
              <div className="text-xs text-orange-700">Outstanding</div>
              <div className="text-lg font-bold text-orange-900">₹{outstanding?.toLocaleString()}</div>
            </div>
            <div className="col-span-3">
              <span className={`px-2 py-1 rounded-full text-xs font-semibold ${statusColor[summary.status]}`}>{summary.status}</span>
            </div>
          </div>
        )}

        {!loading && !summary && (
          <p className="text-sm text-gray-500 mb-4">No payment recorded yet. Record the first payment with the total agreed amount below.</p>
        )}

        <form onSubmit={recordPayment} className="space-y-3 mb-4">
          {!summary && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Total Agreed Amount (₹)</label>
              <input type="number" min="0" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount Being Paid Now (₹)</label>
            <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          {!summary && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date (optional)</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
            <input value={note} onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <button type="submit" disabled={submitting} className="w-full px-4 py-2 rounded bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? 'Recording...' : 'Record Payment'}
          </button>
        </form>

        {!loading && summary && summary.history.length > 0 && (
          <div>
            <h4 className="text-sm font-semibold text-gray-700 mb-2">History</h4>
            <ul className="divide-y divide-gray-200 border border-gray-200 rounded">
              {summary.history.map(h => (
                <li key={h.id} className="p-3 text-sm flex justify-between">
                  <div>
                    <div className="font-semibold text-gray-900">₹{Number(h.amount).toLocaleString()}</div>
                    {h.note && <div className="text-xs text-gray-500">{h.note}</div>}
                  </div>
                  <div className="text-xs text-gray-500">{new Date(h.paidAt).toLocaleDateString()}</div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignmentsPanel;
