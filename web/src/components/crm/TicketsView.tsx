import React, { useEffect, useState } from 'react';

type Ticket = {
  _id: string;
  subject: string;
  message: string;
  status: 'open' | 'closed' | 'pending';
  createdAt?: string;
};

/**
 * TicketsView
 * Shows organizer-facing support tickets. Expected backend endpoints:
 * GET /support/tickets?organizerId=... (or /api/support/tickets)
 * POST /support/tickets/:id/respond
 * PUT /support/tickets/:id/close
 */
export default function TicketsView() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const limit = 10;

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function fetchTickets() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (query) params.set('q', query);
      const res = await fetch(`/support/tickets?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to load tickets');
      const data = await res.json();
      setTickets(data.data || data || []);
      setPages(data.pagination?.pages || 1);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function closeTicket(id: string) {
    try {
      const res = await fetch(`/support/tickets/${id}/close`, { method: 'PUT' });
      if (res.ok) fetchTickets();
    } catch (e) {
      console.error(e);
    }
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex items-center gap-2 mb-4">
        <input
          className="border rounded px-2 py-1 flex-1"
          placeholder="Search tickets by subject or message"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button className="px-3 py-1 border rounded" onClick={() => fetchTickets()}>Search</button>
      </div>

      {loading ? (
        <div className="text-gray-600">Loading tickets...</div>
      ) : (
        <div>
          {tickets.length === 0 ? (
            <div className="text-gray-600">No tickets</div>
          ) : (
            <ul>
              {tickets.map(t => (
                <li key={t._id} className="mb-3 border-b pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-semibold">{t.subject}</div>
                      <div className="text-sm text-gray-700">{t.message}</div>
                    </div>
                    <div className="text-sm text-gray-500">{t.status}</div>
                  </div>
                  <div className="mt-2">
                    {t.status !== 'closed' && <button className="text-sm text-red-600" onClick={() => closeTicket(t._id)}>Close</button>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-gray-600">Page {page} of {pages}</div>
            <div className="flex gap-2">
              <button className="px-2 py-1 border rounded" disabled={page <= 1} onClick={() => { setPage(p => Math.max(1, p - 1)); fetchTickets(); }}>Prev</button>
              <button className="px-2 py-1 border rounded" disabled={page >= pages} onClick={() => { setPage(p => Math.min(pages, p + 1)); fetchTickets(); }}>Next</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
