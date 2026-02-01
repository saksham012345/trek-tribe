import React, { useState, useEffect } from 'react';
import api from '../config/api';
import {
  MessageSquare,
  User,
  Clock,
  CheckCircle,
  AlertTriangle,
  Phone,
  Mail,
  Search,
  Send,
  Star,
  Loader,
  RefreshCw,
  BarChart3,
  Headphones,
  TrendingUp
} from 'lucide-react';

interface AgentStats {
  tickets: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    unassigned: number;
  };
  performance: {
    avgResolutionTimeHours: number;
    avgSatisfactionRating: number;
    resolvedLast30Days: number;
  };
  recentActivity: any[];
}

interface Trip {
  _id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  price: number;
  participants: any[];
  status: string;           // active, cancelled, completed
  verificationStatus: string; // pending, approved, rejected
  organizerId: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    organizerProfile?: any;
  };
  createdAt: string;
}

interface Ticket {
  _id: string;
  ticketId: string;
  subject: string;
  status: string;
  priority: string;
  category: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  assignedAgentId?: any;
  createdAt: string;
  updatedAt: string;
  messages: any[];
  relatedTripId?: any;
}

interface Customer {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  createdAt: string;
}

const AgentDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<AgentStats | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Trip management
  const [trips, setTrips] = useState<Trip[]>([]);
  const [tripFilters, setTripFilters] = useState({
    status: 'pending', // default to pending verification
    search: ''
  });
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);


  // Filters and search
  const [filters, setFilters] = useState({
    status: 'all',
    priority: 'all',
    category: 'all',
    assigned: 'all',
    search: ''
  });

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Message form
  const [newMessage, setNewMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState('');

  // Communication tools
  const [whatsappMessage, setWhatsappMessage] = useState({ phone: '', message: '' });
  const [searchCustomers, setSearchCustomers] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);

  // Service status
  const [serviceStatus, setServiceStatus] = useState<any>(null);

  const fetchAgentStats = async () => {
    try {
      const response = await api.get('/agent/stats');
      const statsData = response.data as AgentStats;
      setStats(statsData);
    } catch (error: any) {
      console.error('Error fetching agent stats:', error);
      setError('Failed to load agent dashboard. Please check your authentication.');
    }
  };

  const fetchTickets = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        ...filters
      });

      const response = await api.get(`/agent/tickets?${params}`);
      const ticketData = response.data as { tickets: Ticket[]; pagination: { current: number; pages: number } };
      setTickets(ticketData.tickets);
      setCurrentPage(ticketData.pagination.current);
      setTotalPages(ticketData.pagination.pages);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to fetch tickets');
    } finally {
      setLoading(false);
    }
  };

  const fetchTicketDetails = async (ticketId: string) => {
    try {
      const response = await api.get(`/agent/tickets/${ticketId}`);
      const ticketData = response.data as { ticket: Ticket };
      setSelectedTicket(ticketData.ticket);
      setActiveTab('ticket-details'); // Switch to details view automatically
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to fetch ticket details');
    }
  };

  const assignTicket = async (ticketId: string) => {
    try {
      await api.post(`/agent/tickets/${ticketId}/assign`);
      await fetchTickets(currentPage); // Refresh list to remove from 'unassigned'
      // Auto-select the ticket to enter resolution flow immediately
      fetchTicketDetails(ticketId);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to assign ticket');
    }
  };

  const updateTicketStatus = async (ticketId: string, status: string) => {
    try {
      await api.patch(`/agent/tickets/${ticketId}/status`, { status });
      fetchTickets(currentPage);
      if (selectedTicket?.ticketId === ticketId) {
        fetchTicketDetails(ticketId);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to update ticket status');
    }
  };

  const suggestResolution = async (ticketId: string) => {
    try {
      setAiLoading(true);
      setAiSuggestion('');
      const resp = await api.post(`/agent/tickets/${ticketId}/ai-resolve`);
      setAiSuggestion(resp.data?.suggestion || 'No suggestion received');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to get AI suggestion');
    } finally {
      setAiLoading(false);
    }
  };

  const resolveWithSuggestion = async (ticketId: string, suggestion?: string) => {
    try {
      const body = { resolutionNote: suggestion || aiSuggestion || 'Resolved by agent' };
      await api.post(`/agent/tickets/${ticketId}/resolve`, body);
      fetchTickets(currentPage);
      if (selectedTicket?.ticketId === ticketId) fetchTicketDetails(ticketId);
      setAiSuggestion('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resolve ticket');
    }
  };

  const sendMessage = async () => {
    if (!selectedTicket || !newMessage.trim()) return;

    try {
      setSendingMessage(true);
      await api.post(`/agent/tickets/${selectedTicket.ticketId}/messages`, {
        message: newMessage
      });
      setNewMessage('');
      fetchTicketDetails(selectedTicket.ticketId);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to send message');
    } finally {
      setSendingMessage(false);
    }
  };

  const searchCustomer = async (query: string) => {
    if (query.length < 2) {
      setCustomerSearchResults([]);
      return;
    }

    try {
      const response = await api.get(`/agent/customers/search?q=${encodeURIComponent(query)}`);
      const customerData = response.data as { customers: Customer[] };
      setCustomerSearchResults(customerData.customers);
    } catch (error: any) {
      console.error('Error searching customers:', error);
    }
  };

  const sendWhatsAppMessage = async () => {
    if (!whatsappMessage.phone || !whatsappMessage.message) return;

    try {
      await api.post('/agent/whatsapp/send', whatsappMessage);
      setWhatsappMessage({ phone: '', message: '' });
      alert('WhatsApp message sent successfully!');
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to send WhatsApp message');
    }
  };

  const fetchServiceStatus = async () => {
    try {
      const response = await api.get('/agent/services/status');
      const statusData = response.data as any;
      setServiceStatus(statusData);
    } catch (error: any) {
      console.error('Error fetching service status:', error);
    }
  };

  const fetchTrips = async (page = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...tripFilters
      });

      const response = await api.get(`/agent/trips?${params}`);
      const tripData = response.data as { trips: Trip[]; pagination: { current: number; pages: number } };
      setTrips(tripData.trips);
      setCurrentPage(tripData.pagination.current);
      setTotalPages(tripData.pagination.pages);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to fetch trips');
    } finally {
      setLoading(false);
    }
  };

  const verifyTrip = async (tripId: string) => {
    try {
      if (!window.confirm('Are you sure you want to approve this trip? It will become live immediately.')) return;

      await api.post(`/agent/trips/${tripId}/verify`, { notes: 'Verified by agent' });
      alert('Trip approved successfully!');
      fetchTrips(currentPage);
      setSelectedTrip(null);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to approve trip');
    }
  };

  const rejectTrip = async () => {
    if (!selectedTrip || !rejectionReason.trim()) return;

    try {
      await api.post(`/agent/trips/${selectedTrip._id}/reject`, { reason: rejectionReason });
      alert('Trip rejected.');
      setShowRejectModal(false);
      setRejectionReason('');
      setSelectedTrip(null);
      fetchTrips(currentPage);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to reject trip');
    }
  };

  const completeTrip = async (tripId: string) => {
    try {
      if (!window.confirm('Mark this trip as completed?')) return;

      await api.post(`/agent/trips/${tripId}/complete`);
      alert('Trip marked as completed.');
      fetchTrips(currentPage);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to complete trip');
    }
  };

  useEffect(() => {
    const initializeDashboard = async () => {
      try {
        await fetchAgentStats();
        await fetchTickets();
        await fetchServiceStatus();
      } catch (error) {
        console.error('Failed to initialize agent dashboard:', error);
        setError('Failed to load agent dashboard. Please try refreshing the page.');
        setLoading(false);
      }
    };

    initializeDashboard();
  }, []);

  useEffect(() => {
    if (activeTab === 'tickets') fetchTickets(1);
    if (activeTab === 'trips') fetchTrips(1);
  }, [filters, tripFilters, activeTab]);

  useEffect(() => {
    if (searchCustomers) {
      const debounce = setTimeout(() => searchCustomer(searchCustomers), 300);
      return () => clearTimeout(debounce);
    } else {
      setCustomerSearchResults([]);
    }
  }, [searchCustomers]);

  const getStatusColor = (status: string) => {
    const colors = {
      open: 'bg-red-100 text-red-800',
      'in-progress': 'bg-yellow-100 text-yellow-800',
      'waiting-customer': 'bg-blue-100 text-blue-800',
      resolved: 'bg-green-100 text-green-800',
      closed: 'bg-gray-100 text-gray-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      low: 'bg-blue-100 text-blue-800',
      medium: 'bg-yellow-100 text-yellow-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Add early return if there's an error to prevent white screen
  if (error && !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="text-red-500 mb-4">
            <AlertTriangle className="mx-auto" size={48} />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Agent Dashboard Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="space-y-3">
            <button
              onClick={() => {
                setError('');
                setLoading(true);
                fetchAgentStats();
                fetchTickets();
                fetchServiceStatus();
              }}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="inline mr-2" size={16} />
              Retry Loading Dashboard
            </button>
            <p className="text-sm text-gray-500">
              Make sure you're logged in as an agent or admin.
            </p>
          </div>
        </div>
      </div>
    );
  }


  const renderTrips = () => (
    <div className="space-y-6">
      {/* Trip Filters */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search trips..."
              value={tripFilters.search}
              onChange={(e) => setTripFilters({ ...tripFilters, search: e.target.value })}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          <select
            value={tripFilters.status}
            onChange={(e) => setTripFilters({ ...tripFilters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="pending">Pending Verification</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled/Rejected</option>
            <option value="completed">Completed</option>
            <option value="all">All Trips</option>
          </select>

          <button
            onClick={() => fetchTrips(currentPage)}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Trips List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Trip</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organizer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Dates</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Verif. Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {trips.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    No trips found matching the filters.
                  </td>
                </tr>
              ) : (
                trips.map((trip) => (
                  <tr key={trip._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{trip.title}</div>
                      <div className="text-xs text-gray-500">{trip.destination} • ${trip.price}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{trip.organizerId?.name || 'Unknown'}</div>
                      <div className="text-xs text-gray-500">{trip.organizerId?.email}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${trip.status === 'active' ? 'bg-green-100 text-green-800' :
                        trip.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                        {trip.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${trip.verificationStatus === 'approved' ? 'bg-green-100 text-green-800' :
                        trip.verificationStatus === 'rejected' ? 'bg-red-100 text-red-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                        {trip.verificationStatus}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                      {trip.verificationStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => verifyTrip(trip._id)}
                            className="text-green-600 hover:text-green-900"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedTrip(trip);
                              setShowRejectModal(true);
                            }}
                            className="text-red-600 hover:text-red-900"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {trip.status === 'active' && (
                        <button
                          onClick={() => completeTrip(trip._id)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Mark Complete
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex justify-between items-center">
            <span className="text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
            <div className="space-x-2">
              <button
                onClick={() => fetchTrips(currentPage - 1)}
                disabled={currentPage <= 1}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Previous
              </button>
              <button
                onClick={() => fetchTrips(currentPage + 1)}
                disabled={currentPage >= totalPages}
                className="px-3 py-1 border rounded disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedTrip && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-bold mb-4">Reject Trip: {selectedTrip.title}</h3>
            <textarea
              className="w-full border rounded p-2 mb-4"
              rows={4}
              placeholder="Reason for rejection..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectionReason('');
                  setSelectedTrip(null);
                }}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={rejectTrip}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Reject Trip
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDashboard = () => (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-blue-500">
          <div className="flex items-center">
            <MessageSquare className="text-blue-500" size={24} />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Tickets</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.tickets.total || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-yellow-500">
          <div className="flex items-center">
            <Clock className="text-yellow-500" size={24} />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.tickets.inProgress || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-green-500">
          <div className="flex items-center">
            <CheckCircle className="text-green-500" size={24} />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Resolved</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.tickets.resolved || 0}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow border-l-4 border-red-500">
          <div className="flex items-center">
            <AlertTriangle className="text-red-500" size={24} />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Unassigned</p>
              <p className="text-2xl font-bold text-gray-900">{stats?.tickets.unassigned || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <BarChart3 className="text-purple-500" size={24} />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Resolution Time</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.performance.avgResolutionTimeHours?.toFixed(1) || '0'} hrs
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Star className="text-yellow-500" size={24} />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Satisfaction Rating</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.performance.avgSatisfactionRating?.toFixed(1) || 'N/A'}/5
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <TrendingUp className="text-green-500" size={24} />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Resolved (30 days)</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.performance.resolvedLast30Days || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-3">
          {stats?.recentActivity?.map((ticket) => (
            <div key={ticket._id} className="flex items-center justify-between py-3 border-b">
              <div>
                <p className="font-medium text-gray-900">{ticket.ticketId}</p>
                <p className="text-sm text-gray-600">{ticket.subject}</p>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs rounded ${getStatusColor(ticket.status)}`}>
                  {ticket.status}
                </span>
                <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(ticket.priority)}`}>
                  {ticket.priority}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Service Status */}
      {serviceStatus && (
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Service Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">Email Service</span>
              <span className={`px-2 py-1 text-xs rounded ${serviceStatus.email?.isReady ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                {serviceStatus.email?.isReady ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-600">WhatsApp Service</span>
              <span className={`px-2 py-1 text-xs rounded ${serviceStatus.whatsapp?.isReady ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                {serviceStatus.whatsapp?.isReady ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderTickets = () => (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                placeholder="Search tickets..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="waiting-customer">Waiting Customer</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>

          <select
            value={filters.priority}
            onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>

          <select
            value={filters.assigned}
            onChange={(e) => setFilters({ ...filters, assigned: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="all">All Tickets</option>
            <option value="me">My Tickets</option>
            <option value="unassigned">Unassigned</option>
          </select>

          <button
            onClick={() => fetchTickets(currentPage)}
            className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <RefreshCw size={16} className="mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Tickets List */}
      <div className="bg-white rounded-lg shadow">
        {loading ? (
          <div className="p-8 text-center">
            <Loader className="animate-spin mx-auto mb-4" size={32} />
            <p>Loading tickets...</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subject
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Priority
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {tickets?.map((ticket) => (
                    <tr key={ticket._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={() => fetchTicketDetails(ticket.ticketId)}
                          className="text-green-600 hover:text-green-800 font-medium"
                        >
                          {ticket.ticketId}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900 truncate max-w-xs">
                          {ticket.subject}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{ticket.customerName}</div>
                        <div className="text-sm text-gray-500">{ticket.customerEmail}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded ${getStatusColor(ticket.status)}`}>
                          {ticket.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(ticket.createdAt)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                        {!ticket.assignedAgentId && (
                          <button
                            onClick={() => assignTicket(ticket.ticketId)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            Assign
                          </button>
                        )}
                        <button
                          onClick={() => fetchTicketDetails(ticket.ticketId)}
                          className="text-green-600 hover:text-green-800"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    Page {currentPage} of {totalPages}
                  </div>
                  <div className="space-x-2">
                    <button
                      onClick={() => fetchTickets(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => fetchTickets(currentPage + 1)}
                      disabled={currentPage >= totalPages}
                      className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  const renderTicketDetails = () => {
    if (!selectedTicket) {
      return (
        <div className="bg-white p-8 rounded-lg shadow text-center">
          <MessageSquare className="mx-auto mb-4 text-gray-400" size={48} />
          <p className="text-gray-500">Select a ticket to view details</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {/* Ticket Header */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{selectedTicket.ticketId}</h2>
              <p className="text-gray-600 mt-1">{selectedTicket.subject}</p>
            </div>
            <div className="flex space-x-2">
              <span className={`px-2 py-1 text-xs rounded ${getStatusColor(selectedTicket.status)}`}>
                {selectedTicket.status}
              </span>
              <span className={`px-2 py-1 text-xs rounded ${getPriorityColor(selectedTicket.priority)}`}>
                {selectedTicket.priority}
              </span>
            </div>
          </div>

          {/* Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Customer Information</h3>
              <div className="space-y-2">
                <p><strong>Name:</strong> {selectedTicket.customerName}</p>
                <p><strong>Email:</strong> {selectedTicket.customerEmail}</p>
                {selectedTicket.customerPhone && (
                  <p><strong>Phone:</strong> {selectedTicket.customerPhone}</p>
                )}
                <p><strong>Category:</strong> {selectedTicket.category}</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Ticket Information</h3>
              <div className="space-y-2">
                <p><strong>Created:</strong> {formatDate(selectedTicket.createdAt)}</p>
                <p><strong>Updated:</strong> {formatDate(selectedTicket.updatedAt)}</p>
                {selectedTicket.assignedAgentId && (
                  <p><strong>Assigned to:</strong> {selectedTicket.assignedAgentId.name}</p>
                )}
                {selectedTicket.relatedTripId && (
                  <p><strong>Related Trip:</strong> {selectedTicket.relatedTripId.title}</p>
                )}
              </div>
            </div>
          </div>

          {/* Status Actions */}
          <div className="mt-6 flex space-x-2">
            {!selectedTicket.assignedAgentId && (
              <button
                onClick={() => assignTicket(selectedTicket.ticketId)}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Assign to Me
              </button>
            )}
            <select
              value={selectedTicket.status}
              onChange={(e) => updateTicketStatus(selectedTicket.ticketId, e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded"
            >
              <option value="open">Open</option>
              <option value="in-progress">In Progress</option>
              <option value="waiting-customer">Waiting Customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            {/* AI Suggest / Resolve */}
            <div className="ml-2 flex items-center space-x-2">
              <button
                onClick={() => suggestResolution(selectedTicket.ticketId)}
                disabled={aiLoading}
                className="px-3 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                {aiLoading ? 'Suggesting...' : 'Suggest (AI)'}
              </button>
              <button
                onClick={() => resolveWithSuggestion(selectedTicket.ticketId)}
                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Resolve with Suggestion
              </button>
            </div>
          </div>
        </div>

        {/* AI Suggestion Preview */}
        {aiSuggestion && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4 border">
            <h4 className="font-medium text-gray-800 mb-2">AI Suggested Resolution</h4>
            <textarea
              value={aiSuggestion}
              onChange={(e) => setAiSuggestion(e.target.value)}
              rows={4}
              className="w-full p-2 border rounded"
            />
            <div className="mt-2 flex space-x-2">
              <button
                onClick={() => resolveWithSuggestion(selectedTicket.ticketId, aiSuggestion)}
                className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                Resolve with This
              </button>
              <button
                onClick={() => { navigator.clipboard?.writeText(aiSuggestion); }}
                className="px-3 py-2 bg-gray-200 rounded"
              >
                Copy
              </button>
              <button
                onClick={() => setAiSuggestion('')}
                className="px-3 py-2 bg-red-100 text-red-700 rounded"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Conversation</h3>

          <div className="space-y-4 max-h-96 overflow-y-auto mb-4">
            {selectedTicket.messages?.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.sender === 'agent' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${message.sender === 'agent'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-200 text-gray-900'
                    }`}
                >
                  <p className="text-sm font-medium mb-1">{message.senderName}</p>
                  <p className="text-sm">{message.message}</p>
                  <p className="text-xs opacity-75 mt-1">
                    {formatDate(message.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Message Input */}
          <div className="flex space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            />
            <button
              onClick={sendMessage}
              disabled={sendingMessage || !newMessage.trim()}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {sendingMessage ? <Loader className="animate-spin" size={16} /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderCommunication = () => (
    <div className="space-y-6">
      {/* Customer Search */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Customer Search</h3>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search customers by name, email, or phone..."
            value={searchCustomers}
            onChange={(e) => setSearchCustomers(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {customerSearchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {customerSearchResults?.map((customer) => (
              <div key={customer._id} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{customer.name}</p>
                  <p className="text-sm text-gray-600">{customer.email}</p>
                  {customer.phone && <p className="text-sm text-gray-600">{customer.phone}</p>}
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setWhatsappMessage({ ...whatsappMessage, phone: customer.phone || '' })}
                    className="text-green-600 hover:text-green-800"
                  >
                    <Phone size={16} />
                  </button>
                  <button
                    onClick={() => window.location.href = `mailto:${customer.email}`}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <Mail size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* WhatsApp Messaging */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">WhatsApp Messaging</h3>
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Customer phone number"
            value={whatsappMessage.phone}
            onChange={(e) => setWhatsappMessage({ ...whatsappMessage, phone: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <textarea
            placeholder="Message content..."
            value={whatsappMessage.message}
            onChange={(e) => setWhatsappMessage({ ...whatsappMessage, message: e.target.value })}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <button
            onClick={sendWhatsAppMessage}
            disabled={!whatsappMessage.phone || !whatsappMessage.message}
            className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Send WhatsApp Message
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Headphones className="text-green-600 mr-3" size={24} />
              <h1 className="text-xl font-semibold text-gray-900">Agent Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">Customer Support Portal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { key: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { key: 'trips', label: 'Trips Review', icon: CheckCircle },
              { key: 'tickets', label: 'Tickets', icon: MessageSquare },
              { key: 'ticket-details', label: 'Ticket Details', icon: User },
              { key: 'communication', label: 'Communication', icon: Phone }
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`${activeTab === tab.key
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
                >
                  <Icon className="mr-2" size={16} />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-6">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
            <button
              onClick={() => setError('')}
              className="float-right text-red-700 hover:text-red-900"
            >
              ×
            </button>
          </div>
        )}

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'tickets' && renderTickets()}
        {activeTab === 'trips' && renderTrips()}
        {activeTab === 'ticket-details' && renderTicketDetails()}
        {activeTab === 'communication' && renderCommunication()}
      </div>
    </div>
  );
};

export default AgentDashboard;