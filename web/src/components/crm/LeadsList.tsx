import React, { useEffect, useState } from 'react';

type Lead = {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  note?: string;
  createdAt?: string;
};

/**
 * LeadsList
 * Fetches leads from the backend and displays them. Includes simple Create/Edit flow
 * by opening the LeadForm component inline. The backend endpoints expected:
 * GET /api/crm/leads
 * POST /api/crm/leads
 * PUT /api/crm/leads/:id
 * DELETE /api/crm/leads/:id
 */
export default function LeadsList() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const limit = 10;

  useEffect(() => {
    fetchLeads();
    // reset page when query changes
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function fetchLeads() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (query) params.set('q', query);
      const res = await fetch(`/api/crm/leads?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load leads');
      const data = await res.json();
      // API expected to return { success, data, pagination }
      setLeads(data.data || []);
      setPages(data.pagination?.pages || 1);
    } catch (e) {
      console.error(e);
      setError('Failed to load leads. You may not have access or the server is down.');
    } finally {
      setLoading(false);
    }
  }

  async function removeLead(id: string) {
    if (!globalThis.confirm('Delete this lead?')) return;
    try {
      const res = await fetch(`/api/crm/leads/${id}`, { method: 'DELETE' });
      if (res.ok) fetchLeads();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="bg-white rounded shadow p-4">
      {error && <div className="text-red-600 mb-2">{error}</div>}
      <div className="flex items-center gap-2 mb-4">
        <input
          className="border rounded px-2 py-1 flex-1"
          placeholder="Search leads by name, email or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="bg-blue-600 text-white px-3 py-1 rounded" onClick={() => setEditing({ _id: '', name: '', email: '', phone: '' })}>+ New</button>
      </div>

      {editing && (
        <div className="mb-4 p-3 border rounded">
          <LeadForm
            lead={editing}
            onSaved={() => {
              setEditing(null);
              fetchLeads();
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      )}

      {loading ? (
        <div className="text-gray-600">Loading leads...</div>
      ) : (
        <div>
          <table className="w-full text-left table-fixed">
            <thead>
              <tr className="text-sm text-gray-700 border-b">
                <th className="py-2">Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th className="w-40">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(l => (
                <tr key={l._id} className="odd:bg-gray-50">
                  <td className="py-2">{l.name}</td>
                  <td>{l.email}</td>
                  <td>{l.phone}</td>
                  <td>
                    <button className="text-sm text-blue-600" onClick={() => setEditing(l)}>Edit</button>
                    <button className="text-sm text-red-600 ml-3" onClick={() => removeLead(l._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">Page {page} of {pages}</div>
            <div className="flex gap-2">
              <button className="px-2 py-1 border rounded" disabled={page <= 1} onClick={() => { setPage(p => Math.max(1, p - 1)); fetchLeads(); }}>Prev</button>
              <button className="px-2 py-1 border rounded" disabled={page >= pages} onClick={() => { setPage(p => Math.min(pages, p + 1)); fetchLeads(); }}>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Inline LeadForm is defined here to keep component file small. */
function LeadForm({ lead, onSaved, onCancel }: { lead: Lead; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(lead.name || '');
  const [email, setEmail] = useState(lead.email || '');
  const [phone, setPhone] = useState(lead.phone || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const method = lead._id ? 'PUT' : 'POST';
      const url = lead._id ? `/api/crm/leads/${lead._id}` : '/api/crm/leads';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone }),
      });
      if (!res.ok) throw new Error('Save failed');
      onSaved();
    } catch (e) {
      console.error(e);
      alert('Failed to save lead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Name" />
      </div>
      <div style={{ marginBottom: 8 }}>
        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" />
      </div>
      <div style={{ marginBottom: 8 }}>
        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Phone" />
      </div>
      <div>
        <button onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
        <button onClick={onCancel} style={{ marginLeft: 8 }}>Cancel</button>
      </div>
    </div>
  );
}
