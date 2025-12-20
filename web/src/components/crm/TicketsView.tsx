import React, { useEffect, useState } from 'react';
import api from '../../config/api';

type Ticket = {
  _id: string;
  ticketId: string;
  subject: string;
  description: string;
  status: 'open' | 'in-progress' | 'waiting-customer' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  createdAt?: string;
  updatedAt?: string;
  messages?: Array<{
    message: string;
    sender: string;
    timestamp: string;
  }>;
};

/**
 * TicketsView
 * Shows support tickets for agents/admins. Uses actual backend endpoints:
 * GET /api/agent/tickets (with filtering)
 * POST /api/support/tickets/:ticketId/resolve
 */
export default function TicketsView() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const limit = 20;

  useEffect(() => {
    fetchTickets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statusFilter, priorityFilter]);

  async function fetchTickets() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        status: statusFilter !== 'all' ? statusFilter : 'all',
        priority: priorityFilter !== 'all' ? priorityFilter : 'all'
      });
      const res = await api.get(`/agent/tickets?${params.toString()}`);
      if (res.status === 200) {
        setTickets(res.data.tickets || res.data.data || []);
        setPages(res.data.pagination?.pages || 1);
      }
    } catch (e: any) {
      console.error('Error fetching tickets:', e);
      setError(e?.response?.data?.error || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }

  async function resolveTicket(ticketId: string, resolutionNote: string) {
    try {
      const res = await api.post(`/support/tickets/${ticketId}/resolve`, { resolutionNote });
      if (res.status === 200) {
        alert('Ticket resolved successfully');
        fetchTickets();
      }
    } catch (e: any) {
      console.error('Error resolving ticket:', e);
      alert(e?.response?.data?.error || 'Failed to resolve ticket');
    }
  }

  return (
    <div className="bg-white rounded shadow p-6">
      <h2 className="text-2xl font-bold mb-4">Support Tickets</h2>

      {/* Filters */}
      <div className="flex gap-4 mb-4 flex-wrap">
        <select
          className="border rounded px-3 py-2"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Status</option>
          <option value="open">Open</option>
          <option value="in-progress">In Progress</option>
          <option value="waiting-customer">Waiting Customer</option>
          <option value="resolved">Resolved</option>
          <option value="closed">Closed</option>
        </select>

        <select
          className="border rounded px-3 py-2"
          value={priorityFilter}
          onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
        >
          <option value="all">All Priority</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>

        <button
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => fetchTickets()}
        >
          Refresh
        </button>
      </div>

      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}

      {loading ? (
        <div className="text-gray-600 text-center py-8">Loading tickets...</div>
      ) : tickets.length === 0 ? (
        <div className="text-gray-600 text-center py-8">No tickets found</div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => (
            <div key={ticket._id} className="border rounded p-4 hover:bg-gray-50">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm text-gray-500">#{ticket.ticketId}</span>
                    <h3 className="font-semibold text-lg">{ticket.subject}</h3>
                  </div>
                  <p className="text-sm text-gray-700 mt-1">{ticket.description}</p>
                </div>
                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded text-white text-sm ${
                    ticket.status === 'open' ? 'bg-red-500' :
                    ticket.status === 'in-progress' ? 'bg-yellow-500' :
                    ticket.status === 'waiting-customer' ? 'bg-blue-500' :
                    ticket.status === 'resolved' ? 'bg-green-500' : 'bg-gray-500'
                  }`}>
                    {ticket.status}
                  </span>
                  <span className={`inline-block ml-2 px-2 py-1 rounded text-white text-xs ${
                    ticket.priority === 'urgent' ? 'bg-red-600' :
                    ticket.priority === 'high' ? 'bg-orange-500' :
                    ticket.priority === 'medium' ? 'bg-yellow-600' : 'bg-gray-500'
                  }`}>
                    {ticket.priority}
                  </span>
                </div>
              </div>

              <div className="flex gap-4 text-sm text-gray-600 mb-3">
                <span>Created: {ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : 'N/A'}</span>
                <span>Updated: {ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : 'N/A'}</span>
                <span>Messages: {ticket.messages?.length || 0}</span>
              </div>

              {ticket.status !== 'resolved' && ticket.status !== 'closed' && (
                <div className="flex gap-2">
                  <textarea
                    id={`resolve-${ticket._id}`}
                    className="border rounded px-2 py-1 flex-1 text-sm"
                    placeholder="Resolution note..."
                    rows={2}
                  />
                  <button
                    className="px-4 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    onClick={() => {
                      const note = (document.getElementById(`resolve-${ticket._id}`) as HTMLTextAreaElement)?.value || '';
                      resolveTicket(ticket.ticketId, note);
                    }}
                  >
                    Resolve
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-gray-600">Page {page} of {pages}</div>
        <div className="flex gap-2">
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <button
            className="px-3 py-1 border rounded disabled:opacity-50"
            disabled={page >= pages}
            onClick={() => setPage((p) => Math.min(pages, p + 1))}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
        </div>
      )}
    </div>
  );
}
