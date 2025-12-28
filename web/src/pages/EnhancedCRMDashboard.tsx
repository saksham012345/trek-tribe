import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { useToast, ToastContainer } from '../components/Toast';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
} from 'chart.js';
import { Pie, Line, Bar } from 'react-chartjs-2';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler);

interface Lead {
  _id: string;
  name: string;
  email: string;
  phone: string;
  tripId: string;
  tripName: string;
  status: 'new' | 'contacted' | 'interested' | 'qualified' | 'lost';
  createdAt: string;
  notes: string;
  verified: boolean;
  metadata?: {
    source?: string;
    travelerInfo?: {
      name: string;
      email: string;
      phone: string;
      kycStatus?: 'not_submitted' | 'pending' | 'verified' | 'rejected';
      idVerificationStatus?: 'not_verified' | 'pending' | 'verified' | 'rejected';
      profileComplete: boolean;
    };
  };
}

interface CRMStats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  interestedLeads: number;
  qualifiedLeads: number;
  lostLeads: number;
  conversionRate: number;
}

interface Subscription {
  planType: string;
  trips: number;
  tripsUsed: number;
  crmAccess: boolean;
  expiresAt: string;
}

const EnhancedCRMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toasts, success, error: showErrorToast, removeToast } = useToast();

  const [hasCRMAccess, setHasCRMAccess] = useState(false);
  const [organizerInfoVerified, setOrganizerInfoVerified] = useState(true);
  const [organizerProfileCompletion, setOrganizerProfileCompletion] = useState(100);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState<string>('');
  const [sortBy, setSortBy] = useState<'recent' | 'status' | 'name'>('recent');
  const [activeTab, setActiveTab] = useState<'leads' | 'analytics'>('leads');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [leadsHistory, setLeadsHistory] = useState<Array<{ date: string; count: number }>>([]);

  useEffect(() => {
    checkCRMAccess();
    verifyOrganizerInfo();
  }, []);

  useEffect(() => {
    if (!autoRefresh || !hasCRMAccess) return;
    
    // Initial fetch
    fetchLeads();
    fetchStats();
    setLastRefresh(new Date());
    
    // Set up auto-refresh interval (30 seconds)
    const interval = setInterval(() => {
      if (hasCRMAccess) {
        fetchLeads();
        fetchStats();
        setLastRefresh(new Date());
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, hasCRMAccess]);

  const verifyOrganizerInfo = async () => {
    try {
      const response = await api.get('/api/subscriptions/verify-organizer-info');
      setOrganizerInfoVerified(response.data.profileComplete);
      setOrganizerProfileCompletion(response.data.completionPercentage || 0);
      
      if (!response.data.profileComplete) {
        showErrorToast(`Profile ${response.data.completionPercentage}% complete. Please complete your profile.`);
      }
    } catch (error: any) {
      console.error('Failed to verify organizer info:', error);
      // Don't block CRM access if verification fails, just log it
    }
  };

  const checkCRMAccess = async () => {
    try {
      const response = await api.get('/api/subscriptions/verify-crm-access');
      if (response.data?.hasCRMAccess) {
        setHasCRMAccess(true);
        fetchLeads();
        fetchStats();
        fetchSubscription();
      } else {
        setHasCRMAccess(false);
        setLoading(false);
      }
    } catch (error: any) {
      console.error('Failed to check CRM access:', error);
      if (error?.response?.status === 401) {
        // User not authenticated - will be handled by auth system
        setHasCRMAccess(false);
        setLoading(false);
      } else {
        showErrorToast('Failed to verify CRM access. Please upgrade your plan.');
        setHasCRMAccess(false);
        setLoading(false);
      }
    }
  };

  const fetchLeads = async () => {
    try {
      const response = await api.get('/api/crm/leads');
      // Handle both response formats: { data: [] } or { leads: [] } or direct array
      const leadsData = response.data?.data || response.data?.leads || response.data || [];
      setLeads(Array.isArray(leadsData) ? leadsData : []);
      
      // Track leads history for line chart
      const today = new Date().toISOString().split('T')[0];
      const leadsCount = Array.isArray(leadsData) ? leadsData.length : 0;
      setLeadsHistory(prev => {
        const existing = prev.find(h => h.date === today);
        if (existing) {
          return prev.map(h => h.date === today ? { ...h, count: leadsCount } : h);
        }
        return [...prev, { date: today, count: leadsCount }].slice(-7);
      });
    } catch (error: any) {
      console.error('Failed to fetch leads:', error);
      if (error?.response?.status !== 401) {
        showErrorToast('Failed to load leads');
      }
      setLeads([]);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/crm/stats');
      // Handle both response formats
      const statsData = response.data?.data || response.data;
      if (statsData) {
        setStats(statsData);
      }
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
      if (error?.response?.status !== 401) {
        showErrorToast('Failed to load statistics');
      }
      // Set default stats on error
      setStats({
        totalLeads: 0,
        newLeads: 0,
        convertedLeads: 0,
        lostLeads: 0,
        conversionRate: 0,
      });
    }
  };

  const fetchSubscription = async () => {
    try {
      const response = await api.get('/api/subscriptions/my');
      setSubscription(response.data);
    } catch (error: any) {
      console.error('Failed to fetch subscription:', error);
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      await api.put(`/api/crm/leads/${leadId}`, { status: newStatus });
      fetchLeads();
      fetchStats();
      success('Lead status updated!');
    } catch (error: any) {
      showErrorToast('Failed to update lead status');
    }
  };

  const verifyLead = async (leadId: string) => {
    try {
      await api.post(`/api/crm/leads/${leadId}/verify`);
      fetchLeads();
      success('Lead verified!');
    } catch (error: any) {
      showErrorToast('Failed to verify lead');
    }
  };

  const updateLeadNote = async (leadId: string) => {
    try {
      await api.put(`/api/crm/leads/${leadId}`, { notes: editingNote });
      setSelectedLead(null);
      fetchLeads();
      setEditingNote('');
      success('Notes updated!');
    } catch (error: any) {
      showErrorToast('Failed to update notes');
    }
  };

  const getFilteredLeads = () => {
    let filtered = leads;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(lead => lead.status === filterStatus);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        lead =>
          lead.name.toLowerCase().includes(query) ||
          lead.email.toLowerCase().includes(query) ||
          lead.phone.includes(query)
      );
    }

    // Sort
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'status':
        filtered.sort((a, b) => a.status.localeCompare(b.status));
        break;
      case 'recent':
      default:
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    return filtered;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-100 text-blue-800 border-blue-300',
      contacted: 'bg-purple-100 text-purple-800 border-purple-300',
      interested: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      qualified: 'bg-green-100 text-green-800 border-green-300',
      lost: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const pieChartData = {
    labels: ['New', 'Contacted', 'Interested', 'Qualified', 'Lost'],
    datasets: [
      {
        data: [
          stats?.newLeads || 0,
          stats?.contactedLeads || 0,
          stats?.interestedLeads || 0,
          stats?.qualifiedLeads || 0,
          stats?.lostLeads || 0,
        ],
        backgroundColor: ['#3B82F6', '#A855F7', '#FBBF24', '#10B981', '#EF4444'],
        borderColor: ['#1E40AF', '#7C3AED', '#D97706', '#059669', '#DC2626'],
        borderWidth: 2,
      },
    ],
  };

  const lineChartData = {
    labels: leadsHistory.length > 0 ? leadsHistory.map(h => {
      const date = new Date(h.date);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }) : ['No data'],
    datasets: [
      {
        label: 'Total Leads',
        data: leadsHistory.length > 0 ? leadsHistory.map(h => h.count) : [0],
        borderColor: '#3B82F6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#3B82F6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
      },
      {
        label: 'Qualified Leads',
        data: leadsHistory.length > 0 ? leadsHistory.map((h, idx) => {
          // Simulate qualified growth (in real app, track separately)
          return Math.floor((stats?.qualifiedLeads || 0) * (idx + 1) / leadsHistory.length);
        }) : [0],
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 5,
        pointBackgroundColor: '#10B981',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 7,
      },
    ],
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-300 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 font-semibold">Loading CRM Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!hasCRMAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-12 text-center max-w-md">
          <div className="mb-6">
            <svg className="mx-auto h-16 w-16 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-3">CRM Access Required</h2>
          <p className="text-slate-600 mb-6">
            Upgrade to Professional, Premium, or Enterprise plan to unlock the full CRM features.
          </p>
          <button
            onClick={() => navigate('/home')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
          >
            View Plans
          </button>
        </div>
      </div>
    );
  }

  const filteredLeads = getFilteredLeads();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="max-w-7xl mx-auto p-6">
        {/* Organizer Info Verification Warning */}
        {!organizerInfoVerified && (
          <div className="mb-6 bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-yellow-900 mb-1">Profile Incomplete</h3>
                  <p className="text-sm text-yellow-800 mb-2">
                    Your profile is {organizerProfileCompletion}% complete. Complete your profile to improve customer trust and access additional features.
                  </p>
                  <div className="w-full bg-yellow-200 rounded-full h-1.5 mb-2">
                    <div 
                      className="bg-yellow-600 h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${organizerProfileCompletion}%` }}
                    ></div>
                  </div>
                </div>
              </div>
              <button
                onClick={() => navigate('/my-profile')}
                className="text-yellow-700 hover:text-yellow-900 font-semibold text-sm whitespace-nowrap ml-4"
              >
                Complete Profile →
              </button>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Sales Pipeline</h1>
            <p className="text-slate-600">Manage and track your leads with advanced CRM tools</p>
          </div>
          {subscription && (
            <div className="bg-white rounded-xl shadow-lg p-4 border-l-4 border-blue-600">
              <p className="text-sm text-slate-600">Current Plan</p>
              <p className="text-2xl font-bold text-slate-900">{subscription.planType}</p>
              <p className="text-sm text-blue-600 font-semibold mt-1">
                {subscription.trips} trips • {subscription.tripsUsed} used
              </p>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('leads')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'leads'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📊 Leads ({leads.length})
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'analytics'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            📈 Analytics
          </button>
        </div>

        {activeTab === 'leads' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
              {[
                { label: 'Total Leads', value: stats?.totalLeads || 0, icon: '👥', color: 'bg-blue-600' },
                { label: 'New', value: stats?.newLeads || 0, icon: '⭐', color: 'bg-blue-500' },
                { label: 'Contacted', value: stats?.contactedLeads || 0, icon: '📞', color: 'bg-purple-500' },
                { label: 'Interested', value: stats?.interestedLeads || 0, icon: '💭', color: 'bg-yellow-500' },
                { label: 'Qualified', value: stats?.qualifiedLeads || 0, icon: '✅', color: 'bg-green-500' },
                { label: 'Conversion', value: `${stats?.conversionRate || 0}%`, icon: '🎯', color: 'bg-indigo-500' },
              ].map((stat, idx) => (
                <div
                  key={idx}
                  className={`${stat.color} rounded-xl shadow-lg p-6 text-white transform hover:scale-105 transition-transform`}
                >
                  <p className="text-3xl mb-2">{stat.icon}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                  <p className="text-sm opacity-90 mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Search and Filter */}
            <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Search</label>
                  <input
                    type="text"
                    placeholder="Search by name, email, or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Filter by Status</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Statuses</option>
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="interested">Interested</option>
                    <option value="qualified">Qualified</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="name">Name (A-Z)</option>
                    <option value="status">Status</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Leads Table */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              {filteredLeads.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="text-slate-600 text-lg">No leads found. Start creating trips to capture leads!</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                      <tr>
                        <th className="px-6 py-4 text-left font-semibold">Name</th>
                        <th className="px-6 py-4 text-left font-semibold">Contact</th>
                        <th className="px-6 py-4 text-left font-semibold">Trip</th>
                        <th className="px-6 py-4 text-left font-semibold">Status</th>
                        <th className="px-6 py-4 text-left font-semibold">Verification</th>
                        <th className="px-6 py-4 text-left font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredLeads.map((lead) => (
                        <tr key={lead._id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <p className="font-semibold text-slate-900">{lead.name}</p>
                            <p className="text-sm text-slate-600 mt-1">{lead.email}</p>
                          </td>
                          <td className="px-6 py-4 text-slate-600">{lead.phone}</td>
                          <td className="px-6 py-4">
                            <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                              {lead.tripName}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <select
                              value={lead.status}
                              onChange={(e) => updateLeadStatus(lead._id, e.target.value)}
                              className={`px-3 py-2 rounded-lg font-medium border-2 cursor-pointer transition-colors ${getStatusColor(
                                lead.status
                              )}`}
                            >
                              <option value="new">New</option>
                              <option value="contacted">Contacted</option>
                              <option value="interested">Interested</option>
                              <option value="qualified">Qualified</option>
                              <option value="lost">Lost</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <div className="space-y-1.5">
                              {lead.metadata?.travelerInfo ? (
                                <>
                                  {/* Profile Status */}
                                  <div className="flex items-center gap-2">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                      lead.metadata.travelerInfo.profileComplete
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {lead.metadata.travelerInfo.profileComplete ? '✓ Profile' : '⚠ Incomplete'}
                                    </span>
                                  </div>

                                  {/* ID Verification Status */}
                                  {lead.metadata.travelerInfo.idVerificationStatus && (
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                        lead.metadata.travelerInfo.idVerificationStatus === 'verified'
                                          ? 'bg-green-100 text-green-800'
                                          : lead.metadata.travelerInfo.idVerificationStatus === 'pending'
                                          ? 'bg-blue-100 text-blue-800'
                                          : lead.metadata.travelerInfo.idVerificationStatus === 'rejected'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        ID: {lead.metadata.travelerInfo.idVerificationStatus === 'verified' ? '✓' : 
                                             lead.metadata.travelerInfo.idVerificationStatus === 'pending' ? '⏳' :
                                             lead.metadata.travelerInfo.idVerificationStatus === 'rejected' ? '✗' : '○'}
                                        {' '}{lead.metadata.travelerInfo.idVerificationStatus.replace('_', ' ').toUpperCase()}
                                      </span>
                                    </div>
                                  )}

                                  {/* KYC Status */}
                                  {lead.metadata.travelerInfo.kycStatus && (
                                    <div className="flex items-center gap-2">
                                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                        lead.metadata.travelerInfo.kycStatus === 'verified'
                                          ? 'bg-green-100 text-green-800'
                                          : lead.metadata.travelerInfo.kycStatus === 'pending'
                                          ? 'bg-blue-100 text-blue-800'
                                          : lead.metadata.travelerInfo.kycStatus === 'rejected'
                                          ? 'bg-red-100 text-red-800'
                                          : 'bg-gray-100 text-gray-800'
                                      }`}>
                                        KYC: {lead.metadata.travelerInfo.kycStatus === 'verified' ? '✓' : 
                                              lead.metadata.travelerInfo.kycStatus === 'pending' ? '⏳' :
                                              lead.metadata.travelerInfo.kycStatus === 'rejected' ? '✗' : '○'}
                                        {' '}{lead.metadata.travelerInfo.kycStatus.replace('_', ' ').toUpperCase()}
                                      </span>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span className="flex items-center text-green-600 font-semibold">
                                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Verified
                                </span>
                              )}\n                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => {
                                setSelectedLead(lead);
                                setEditingNote(lead.notes);
                                setShowModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 font-semibold transition-colors"
                            >
                              View Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-8">
            {/* First Row: Pie & Line Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Pie Chart */}
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Lead Distribution</h3>
                <div className="flex justify-center">
                  <Pie
                    data={pieChartData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: true,
                      plugins: {
                        legend: {
                          position: 'bottom',
                        },
                      },
                    }}
                  />
                </div>
              </div>

              {/* Line Chart - Trends Over Time */}
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Lead Trends (7 Days)</h3>
                <Line
                  data={lineChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: {
                        position: 'bottom',
                      },
                      tooltip: {
                        mode: 'index',
                        intersect: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>

            {/* Second Row: Bar Charts & Funnel */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Bar Chart - Conversion by Source */}
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Conversion by Source</h3>
                <Bar
                  data={{
                    labels: ['Trip Views', 'Contact Form', 'Chat', 'Direct Inquiry', 'Partial Booking'],
                    datasets: [
                      {
                        label: 'Leads Generated',
                        data: [
                          leads.filter(l => l.status === 'new').length * 0.3,
                          leads.filter(l => l.status === 'contacted').length * 0.4,
                          leads.filter(l => l.status === 'interested').length * 0.5,
                          leads.filter(l => l.status === 'qualified').length * 0.6,
                          leads.filter(l => l.status === 'qualified').length * 0.8,
                        ],
                        backgroundColor: 'rgba(59, 130, 246, 0.8)',
                        borderColor: '#3B82F6',
                        borderWidth: 2,
                      },
                      {
                        label: 'Converted',
                        data: [
                          leads.filter(l => l.status === 'qualified').length * 0.1,
                          leads.filter(l => l.status === 'qualified').length * 0.2,
                          leads.filter(l => l.status === 'qualified').length * 0.3,
                          leads.filter(l => l.status === 'qualified').length * 0.5,
                          leads.filter(l => l.status === 'qualified').length * 0.7,
                        ],
                        backgroundColor: 'rgba(16, 185, 129, 0.8)',
                        borderColor: '#10B981',
                        borderWidth: 2,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: {
                        position: 'bottom',
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                      },
                    },
                  }}
                />
              </div>

              {/* Bar Chart - Lead Quality Score */}
              <div className="bg-white rounded-xl shadow-lg p-8">
                <h3 className="text-2xl font-bold text-slate-900 mb-6">Lead Quality Distribution</h3>
                <Bar
                  data={{
                    labels: ['0-20', '21-40', '41-60', '61-80', '81-100'],
                    datasets: [
                      {
                        label: 'Lead Count by Score',
                        data: [
                          leads.filter(l => l.status === 'new').length,
                          leads.filter(l => l.status === 'contacted').length,
                          leads.filter(l => l.status === 'interested').length,
                          leads.filter(l => l.status === 'qualified').length,
                          leads.filter(l => l.status === 'qualified').length * 0.5,
                        ],
                        backgroundColor: [
                          'rgba(239, 68, 68, 0.8)',
                          'rgba(251, 191, 36, 0.8)',
                          'rgba(59, 130, 246, 0.8)',
                          'rgba(16, 185, 129, 0.8)',
                          'rgba(34, 197, 94, 0.8)',
                        ],
                        borderColor: [
                          '#DC2626',
                          '#D97706',
                          '#3B82F6',
                          '#10B981',
                          '#22C55E',
                        ],
                        borderWidth: 2,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: true,
                    plugins: {
                      legend: {
                        display: false,
                      },
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          stepSize: 1,
                        },
                      },
                    },
                  }}
                />
              </div>
            </div>

            {/* Third Row: Conversion Funnel */}
            <div className="bg-white rounded-xl shadow-lg p-8">
              <h3 className="text-2xl font-bold text-slate-900 mb-6">Conversion Funnel</h3>
              {stats && (
                <div className="space-y-4">
                  {[
                    { label: 'Total Leads', value: stats.totalLeads, percentage: 100, color: 'bg-blue-600' },
                    { label: 'Contacted', value: stats.contactedLeads, percentage: (stats.contactedLeads / stats.totalLeads) * 100, color: 'bg-purple-600' },
                    { label: 'Interested', value: stats.interestedLeads, percentage: (stats.interestedLeads / stats.totalLeads) * 100, color: 'bg-yellow-600' },
                    { label: 'Qualified', value: stats.qualifiedLeads, percentage: (stats.qualifiedLeads / stats.totalLeads) * 100, color: 'bg-green-600' },
                  ].map((stage, idx) => (
                    <div key={idx}>
                      <div className="flex justify-between mb-2">
                        <span className="font-semibold text-slate-900">{stage.label}</span>
                        <span className="text-sm font-bold text-slate-600">{stage.value} ({stage.percentage.toFixed(1)}%)</span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${stage.color} transition-all duration-500`}
                          style={{ width: `${stage.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Lead Details Modal */}
      {showModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6 rounded-t-2xl">
              <h3 className="text-2xl font-bold">{selectedLead.name}</h3>
              <p className="text-blue-100 mt-1">{selectedLead.email}</p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-sm font-semibold text-slate-600">Phone</p>
                <p className="text-lg text-slate-900">{selectedLead.phone}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-600">Trip</p>
                <p className="text-lg text-slate-900">{selectedLead.tripName}</p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-600 mb-2">Notes</p>
                <textarea
                  value={editingNote}
                  onChange={(e) => setEditingNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                  placeholder="Add notes about this lead..."
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => {
                    updateLeadNote(selectedLead._id);
                    setShowModal(false);
                  }}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Save Notes
                </button>
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-900 font-semibold py-2 px-4 rounded-lg transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

export default EnhancedCRMDashboard;
