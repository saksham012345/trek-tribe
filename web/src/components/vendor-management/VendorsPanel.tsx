import React, { useEffect, useState, useCallback } from 'react';
import api from '../../config/api';
import { useToast } from '../ui/Toast';
import { Skeleton } from '../ui/Skeleton';

export const VENDOR_CATEGORIES = [
  'hotel', 'homestay', 'campsite', 'transport', 'driver', 'guide', 'trek_leader',
  'equipment_rental', 'food', 'photographer', 'videographer', 'permit_agency',
  'emergency_contact', 'custom'
];

const CATEGORY_LABELS: Record<string, string> = {
  hotel: 'Hotel', homestay: 'Homestay', campsite: 'Campsite', transport: 'Transport',
  driver: 'Driver', guide: 'Guide', trek_leader: 'Trek Leader', equipment_rental: 'Equipment Rental',
  food: 'Food', photographer: 'Photographer', videographer: 'Videographer',
  permit_agency: 'Permit Agency', emergency_contact: 'Emergency Contact', custom: 'Custom'
};

export interface Vendor {
  id: string;
  businessName: string;
  contactPerson?: string | null;
  phone?: string | null;
  email?: string | null;
  whatsappNumber?: string | null;
  category: string;
  customCategoryLabel?: string | null;
  address?: string | null;
  gstNumber?: string | null;
  pricingNotes?: string | null;
  rating?: string | null;
  availabilityStatus: 'available' | 'busy' | 'unavailable';
  notes?: string | null;
  createdAt: string;
}

interface VendorDocument {
  id: string;
  fileName: string;
  fileUrl: string;
  uploadedAt: string;
}

const emptyForm = {
  businessName: '', contactPerson: '', phone: '', email: '', whatsappNumber: '',
  category: 'transport', customCategoryLabel: '', address: '', gstNumber: '',
  pricingNotes: '', availabilityStatus: 'available', notes: ''
};

const availabilityColor: Record<string, string> = {
  available: 'bg-green-100 text-green-800',
  busy: 'bg-yellow-100 text-yellow-800',
  unavailable: 'bg-red-100 text-red-800'
};

const VendorsPanel: React.FC = () => {
  const { add } = useToast();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [detailVendor, setDetailVendor] = useState<Vendor | null>(null);

  const fetchVendors = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/vendors');
      setVendors(res.data || []);
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to load vendors', 'error');
    } finally {
      setLoading(false);
    }
  }, [add]);

  useEffect(() => { fetchVendors(); }, [fetchVendors]);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (v: Vendor) => {
    setEditingId(v.id);
    setForm({
      businessName: v.businessName,
      contactPerson: v.contactPerson || '',
      phone: v.phone || '',
      email: v.email || '',
      whatsappNumber: v.whatsappNumber || '',
      category: v.category,
      customCategoryLabel: v.customCategoryLabel || '',
      address: v.address || '',
      gstNumber: v.gstNumber || '',
      pricingNotes: v.pricingNotes || '',
      availabilityStatus: v.availabilityStatus,
      notes: v.notes || ''
    });
    setShowForm(true);
  };

  const submitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.businessName.trim()) {
      add('Business name is required', 'error');
      return;
    }
    setSubmitting(true);
    const payload: any = { ...form };
    Object.keys(payload).forEach((k) => { if (payload[k] === '') delete payload[k]; });
    try {
      if (editingId) {
        await api.put(`/api/vendors/${editingId}`, payload);
        add('Vendor updated', 'success');
      } else {
        await api.post('/api/vendors', payload);
        add('Vendor created', 'success');
      }
      setShowForm(false);
      fetchVendors();
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to save vendor', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const deleteVendor = async (v: Vendor) => {
    if (!window.confirm(`Delete vendor "${v.businessName}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/api/vendors/${v.id}`);
      add('Vendor deleted', 'success');
      if (detailVendor?.id === v.id) setDetailVendor(null);
      fetchVendors();
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to delete vendor', 'error');
    }
  };

  const filtered = categoryFilter === 'all' ? vendors : vendors.filter(v => v.category === categoryFilter);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All categories</option>
            {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
          </select>
          <span className="text-sm text-gray-500">{filtered.length} vendor{filtered.length !== 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm font-semibold shadow-md hover:bg-blue-700 transition-all"
        >
          + Add Vendor
        </button>
      </div>

      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-100 border-b">
            <tr>
              <th className="p-3 text-left font-semibold text-gray-700">Business</th>
              <th className="p-3 text-left font-semibold text-gray-700">Category</th>
              <th className="p-3 text-left font-semibold text-gray-700">Contact</th>
              <th className="p-3 text-left font-semibold text-gray-700">Status</th>
              <th className="p-3 text-right font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td className="p-3" colSpan={5}>
                <div className="space-y-2">
                  {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}
                </div>
              </td></tr>
            )}
            {!loading && filtered.map(v => (
              <tr key={v.id} className="border-t hover:bg-gray-50 transition">
                <td className="p-3">
                  <button className="font-semibold text-blue-700 hover:underline" onClick={() => setDetailVendor(v)}>
                    {v.businessName}
                  </button>
                </td>
                <td className="p-3 text-gray-700">
                  {v.category === 'custom' && v.customCategoryLabel ? v.customCategoryLabel : CATEGORY_LABELS[v.category] || v.category}
                </td>
                <td className="p-3 text-gray-600">
                  {v.contactPerson && <div>{v.contactPerson}</div>}
                  {v.phone && <div className="text-xs text-gray-500">{v.phone}</div>}
                </td>
                <td className="p-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${availabilityColor[v.availabilityStatus]}`}>
                    {v.availabilityStatus}
                  </span>
                </td>
                <td className="p-3 text-right space-x-2 whitespace-nowrap">
                  <button onClick={() => openEdit(v)} className="text-blue-600 hover:underline text-xs font-semibold">Edit</button>
                  <button onClick={() => deleteVendor(v)} className="text-red-600 hover:underline text-xs font-semibold">Delete</button>
                </td>
              </tr>
            ))}
            {!loading && !filtered.length && (
              <tr><td className="p-6 text-center text-gray-500" colSpan={5}>No vendors yet. Add your first vendor to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">{editingId ? 'Edit Vendor' : 'Add Vendor'}</h3>
            <form onSubmit={submitForm} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Business Name *</label>
                <input required value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {VENDOR_CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Availability</label>
                  <select value={form.availabilityStatus} onChange={(e) => setForm({ ...form, availabilityStatus: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="unavailable">Unavailable</option>
                  </select>
                </div>
              </div>
              {form.category === 'custom' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Custom Category Label</label>
                  <input value={form.customCategoryLabel} onChange={(e) => setForm({ ...form, customCategoryLabel: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
                  <input value={form.whatsappNumber} onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                  <input value={form.gstNumber} onChange={(e) => setForm({ ...form, gstNumber: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Pricing Notes</label>
                  <input value={form.pricingNotes} onChange={(e) => setForm({ ...form, pricingNotes: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded text-sm font-semibold text-gray-600 hover:bg-gray-100">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
                  {submitting ? 'Saving...' : editingId ? 'Save Changes' : 'Create Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {detailVendor && (
        <VendorDetailModal vendor={detailVendor} onClose={() => setDetailVendor(null)} />
      )}
    </div>
  );
};

const VendorDetailModal: React.FC<{ vendor: Vendor; onClose: () => void }> = ({ vendor, onClose }) => {
  const { add } = useToast();
  const [documents, setDocuments] = useState<VendorDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileName, setFileName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/vendors/${vendor.id}/documents`);
      setDocuments(res.data || []);
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  }, [vendor.id, add]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const addDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileName.trim() || !fileUrl.trim()) {
      add('File name and URL are required', 'error');
      return;
    }
    setAdding(true);
    try {
      await api.post(`/api/vendors/${vendor.id}/documents`, { fileName, fileUrl });
      add('Document added', 'success');
      setFileName('');
      setFileUrl('');
      fetchDocuments();
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to add document', 'error');
    } finally {
      setAdding(false);
    }
  };

  const deleteDocument = async (docId: string) => {
    try {
      await api.delete(`/api/vendors/${vendor.id}/documents/${docId}`);
      add('Document removed', 'success');
      fetchDocuments();
    } catch (error: any) {
      add(error?.response?.data?.error || 'Failed to remove document', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">{vendor.businessName} — Documents</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <form onSubmit={addDocument} className="flex gap-2 mb-4">
          <input placeholder="File name (e.g. rate-card.pdf)" value={fileName} onChange={(e) => setFileName(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <input placeholder="File URL" value={fileUrl} onChange={(e) => setFileUrl(e.target.value)}
            className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button type="submit" disabled={adding} className="px-3 py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50">
            Add
          </button>
        </form>
        <p className="text-xs text-gray-400 mb-4">Upload the file via the existing media uploader first, then paste its URL here.</p>

        {loading && <div className="space-y-2">{[...Array(2)].map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>}
        {!loading && (
          <ul className="divide-y divide-gray-200 border border-gray-200 rounded">
            {documents.map(doc => (
              <li key={doc.id} className="flex items-center justify-between p-3 text-sm">
                <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline truncate">{doc.fileName}</a>
                <button onClick={() => deleteDocument(doc.id)} className="text-red-600 hover:underline text-xs font-semibold ml-2">Remove</button>
              </li>
            ))}
            {!documents.length && <li className="p-4 text-center text-gray-500">No documents yet</li>}
          </ul>
        )}
      </div>
    </div>
  );
};

export default VendorsPanel;
