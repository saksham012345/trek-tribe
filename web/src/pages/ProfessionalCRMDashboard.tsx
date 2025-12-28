import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { useToast, ToastContainer } from '../components/Toast';

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

interface Activity {
  id: string;
  type: 'lead_created' | 'status_changed' | 'verified' | 'note_added';
  leadName: string;
  details: string;
  timestamp: Date;
}

const ProfessionalCRMDashboard: React.FC = () => {
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
  const [activeTab, setActiveTab] = useState<'dashboard' | 'leads' | 'analytics'>('dashboard');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [leadsOverTime, setLeadsOverTime] = useState<Array<{ date: string; count: number }>>([]);

  useEffect(() => {
    checkCRMAccess();
    verifyOrganizerInfo();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;
    
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
    }
  };

  const checkCRMAccess = async () => {
    try {
      const response = await api.get('/api/subscriptions/verify-crm-access');
      if (response.data.hasCRMAccess) {
        setHasCRMAccess(true);
        fetchLeads();
        fetchStats();
        fetchSubscription();
      } else {
        setHasCRMAccess(false);
      }
    } catch (error: any) {
      console.error('Failed to check CRM access:', error);
      showErrorToast('Failed to verify CRM access. Please upgrade your plan.');
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      const response = await api.get('/api/crm/leads');
      setLeads(response.data.leads || []);
      
      // Track activity
      const newActivities: Activity[] = (response.data.leads || []).slice(0, 5).map((lead: Lead) => ({
        id: lead._id,
        type: 'lead_created' as const,
        leadName: lead.name,
        details: `Added to ${lead.tripName}`,
        timestamp: new Date(lead.createdAt),
      }));
      setActivities(newActivities);
      
      // Track leads over time
      const today = new Date().toISOString().split('T')[0];
      setLeadsOverTime(prev => {
        const existing = prev.find(h => h.date === today);
        if (existing) {
          return prev.map(h => h.date === today ? { ...h, count: response.data.leads?.length || 0 } : h);
        }
        return [...prev, { date: today, count: response.data.leads?.length || 0 }].slice(-7);
      });
    } catch (error: any) {
      console.error('Failed to fetch leads:', error);
      showErrorToast('Failed to load leads');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/api/crm/stats');
      // Handle multiple response formats
      const statsData = response.data?.data || response.data;
      if (statsData) {
        setStats(statsData);
      } else {
        // Set default stats if no data
        setStats({
          totalLeads: 0,
          newLeads: 0,
          contactedLeads: 0,
          interestedLeads: 0,
          qualifiedLeads: 0,
          lostLeads: 0,
          conversionRate: 0,
        });
      }
    } catch (error: any) {
      console.error('Failed to fetch stats:', error);
      if (error?.response?.status !== 401) {
        // Set default stats on error
        setStats({
          totalLeads: 0,
          newLeads: 0,
          contactedLeads: 0,
          interestedLeads: 0,
          qualifiedLeads: 0,
          lostLeads: 0,
          conversionRate: 0,
        });
      }
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
      await api.post(`/api/crm/leads/${leadId}/verify`, {});
      fetchLeads();
      success('Lead verified!');
    } catch (error: any) {
      showErrorToast('Failed to verify lead');
    }
  };

  const handleSaveNote = async () => {
    if (!selectedLead) return;
    try {
      await api.put(`/api/crm/leads/${selectedLead._id}`, { notes: editingNote });
      fetchLeads();
      setShowModal(false);
      success('Note saved!');
    } catch (error: any) {
      showErrorToast('Failed to save note');
    }
  };

  const getFilteredLeads = () => {
    let filtered = leads;

    if (filterStatus !== 'all') {
      filtered = filtered.filter(lead => lead.status === filterStatus);
    }

    if (searchQuery) {
      filtered = filtered.filter(lead =>
        lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone.includes(searchQuery)
      );
    }

    if (sortBy === 'name') {
      filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'status') {
      filtered = [...filtered].sort((a, b) => a.status.localeCompare(b.status));
    } else {
      filtered = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  const getStatusIcon = (status: string) => {
    const icons: Record<string, string> = {
      new: '⭐',
      contacted: '📞',
      interested: '💭',
      qualified: '✅',
      lost: '❌',
    };
    return icons[status] || '•';
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

  // Sample CRM data for basic organizers (preview)
  const sampleCRMData = {
    stats: {
      totalLeads: 24,
      newLeads: 8,
      contactedLeads: 6,
      interestedLeads: 5,
      qualifiedLeads: 4,
      lostLeads: 1,
      conversionRate: 16.7,
    },
    leads: [
      { _id: '1', name: 'Priya Sharma', email: 'priya@example.com', phone: '+91 98765 43210', tripName: 'Himalayan Trek', status: 'new', createdAt: new Date().toISOString(), notes: '', verified: false },
      { _id: '2', name: 'Rahul Mehta', email: 'rahul@example.com', phone: '+91 98765 43211', tripName: 'Beach Adventure', status: 'contacted', createdAt: new Date().toISOString(), notes: 'Interested in group booking', verified: true },
      { _id: '3', name: 'Sneha Patel', email: 'sneha@example.com', phone: '+91 98765 43212', tripName: 'Desert Safari', status: 'qualified', createdAt: new Date().toISOString(), notes: 'Ready to book', verified: true },
    ],
    activities: [
      { id: '1', type: 'lead_created' as const, leadName: 'Priya Sharma', details: 'Added to Himalayan Trek', timestamp: new Date() },
      { id: '2', type: 'status_changed' as const, leadName: 'Rahul Mehta', details: 'Moved to Contacted', timestamp: new Date() },
      { id: '3', type: 'verified' as const, leadName: 'Sneha Patel', details: 'Lead verified', timestamp: new Date() },
    ],
    leadsOverTime: [
      { date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 3 },
      { date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 5 },
      { date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 4 },
      { date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 6 },
      { date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 8 },
      { date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], count: 10 },
      { date: new Date().toISOString().split('T')[0], count: 24 },
    ]
  };

  if (!hasCRMAccess) {
    // Show sample/preview CRM for basic organizers
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto p-6">
          {/* Preview Banner */}
          <div className="mb-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl p-6 shadow-xl">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold mb-2">✨ CRM Preview Mode</h2>
                <p className="text-blue-100 mb-4">
                  You're viewing a sample CRM dashboard. Upgrade to Premium or Enterprise to unlock live data, real-time updates, and advanced analytics.
                </p>
                <button
                  onClick={() => navigate('/subscribe')}
                  className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                >
                  Upgrade to Unlock CRM
                </button>
              </div>
              <div className="text-right">
                <div className="text-4xl mb-2">👁️</div>
                <p className="text-xs text-blue-100">Preview Only</p>
              </div>
            </div>
          </div>

          {/* Sample Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              { title: 'Total Leads', value: sampleCRMData.stats.totalLeads, icon: '👥', color: 'from-blue-500 to-blue-600' },
              { title: 'New Leads', value: sampleCRMData.stats.newLeads, icon: '⭐', color: 'from-purple-500 to-purple-600' },
              { title: 'Qualified', value: sampleCRMData.stats.qualifiedLeads, icon: '✅', color: 'from-green-500 to-green-600' },
              { title: 'Conversion Rate', value: `${sampleCRMData.stats.conversionRate}%`, icon: '🎯', color: 'from-orange-500 to-orange-600' },
            ].map((card, idx) => (
              <div key={idx} className={`bg-gradient-to-br ${card.color} rounded-xl p-6 text-white shadow-lg`}>
                <div className="flex justify-between items-start mb-4">
                  <span className="text-3xl">{card.icon}</span>
                  <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">Sample</span>
                </div>
                <p className="text-sm opacity-90">{card.title}</p>
                <p className="text-3xl font-bold mt-2">{card.value}</p>
              </div>
            ))}
          </div>

          {/* Sample Leads Table */}
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-slate-900">Sample Leads (Preview)</h3>
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">Preview Mode</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-slate-900 to-slate-800 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Name</th>
                    <th className="px-6 py-4 text-left font-semibold">Contact</th>
                    <th className="px-6 py-4 text-left font-semibold">Trip</th>
                    <th className="px-6 py-4 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {sampleCRMData.leads.map((lead) => (
                    <tr key={lead._id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{lead.name}</p>
                        <p className="text-sm text-slate-600">{lead.email}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{lead.phone}</td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">{lead.tripName}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-2 rounded-lg font-medium ${getStatusColor(lead.status)}`}>
                          {getStatusIcon(lead.status)} {lead.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800">
                <strong>Unlock Premium Features:</strong> Get real-time lead tracking, conversion analytics, automated follow-ups, and priority support. 
                <button onClick={() => navigate('/subscribe')} className="ml-2 text-blue-600 font-semibold hover:underline">
                  Upgrade Now →
                </button>
              </p>
            </div>
          </div>

          {/* Sample Analytics */}
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Sample Analytics (Preview)</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-6 border-2 border-dashed border-slate-300">
                <h4 className="font-bold text-slate-900 mb-4">Lead Distribution</h4>
                <div className="space-y-3">
                  {[
                    { label: 'New', value: sampleCRMData.stats.newLeads, color: 'bg-blue-500' },
                    { label: 'Contacted', value: sampleCRMData.stats.contactedLeads, color: 'bg-purple-500' },
                    { label: 'Qualified', value: sampleCRMData.stats.qualifiedLeads, color: 'bg-green-500' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${item.color}`}></div>
                      <span className="font-medium text-slate-700 w-20">{item.label}</span>
                      <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div className={`${item.color} h-full`} style={{ width: `${(item.value / sampleCRMData.stats.totalLeads) * 100}%` }}></div>
                      </div>
                      <span className="font-bold text-slate-900 w-12 text-right">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-gradient-to-br from-slate-50 to-green-50 rounded-xl p-6 border-2 border-dashed border-slate-300">
                <h4 className="font-bold text-slate-900 mb-4">Leads Over Time (7 Days)</h4>
                <div className="space-y-2">
                  {sampleCRMData.leadsOverTime.slice(-7).map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 w-16">{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500 to-green-400 h-full" style={{ width: `${(item.count / 30) * 100}%` }}></div>
                      </div>
                      <span className="text-sm font-bold text-slate-900 w-8 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const filteredLeads = getFilteredLeads();
  const conversionRate = stats?.conversionRate || 0;
  const pipelineValue = stats?.totalLeads || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-50 to-blue-50">
      <div className="max-w-7xl mx-auto p-6">
        
        {/* Header with Profile Warning */}
        {!organizerInfoVerified && (
          <div className="mb-6 bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-md">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <h3 className="text-sm font-semibold text-yellow-900">Profile Incomplete - {organizerProfileCompletion}%</h3>
                  <p className="text-xs text-yellow-800 mt-1">Complete your profile to build customer trust</p>
                </div>
              </div>
              <button
                onClick={() => navigate('/my-profile')}
                className="text-yellow-700 hover:text-yellow-900 font-semibold text-xs whitespace-nowrap ml-4"
              >
                Complete →
              </button>
            </div>
          </div>
        )}

        {/* Main Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-slate-900">CRM Dashboard</h1>
            <p className="text-slate-600 mt-2">Manage leads, track conversions, and grow your business</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-600">Last updated: {lastRefresh ? lastRefresh.toLocaleTimeString() : 'Loading...'}</p>
            <div className="mt-2 flex gap-2">
              <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-2 rounded-lg shadow">
                <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} className="w-4 h-4" />
                <span className="text-xs font-medium">Auto-refresh</span>
              </label>
              <button
                onClick={() => { fetchLeads(); fetchStats(); setLastRefresh(new Date()); }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition"
              >
                ↻ Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 border-b border-slate-200 bg-white rounded-t-xl">
          {[
            { id: 'dashboard', label: '📊 Dashboard', icon: 'dashboard' },
            { id: 'leads', label: '👥 Leads', icon: 'leads', badge: leads.length },
            { id: 'analytics', label: '📈 Analytics', icon: 'analytics' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
              {tab.badge && <span className="bg-red-500 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center">{tab.badge}</span>}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { title: 'Total Leads', value: stats?.totalLeads || 0, icon: '👥', color: 'from-blue-500 to-blue-600', trend: '+12%' },
                { title: 'New Leads', value: stats?.newLeads || 0, icon: '⭐', color: 'from-purple-500 to-purple-600', trend: '+5%' },
                { title: 'Qualified', value: stats?.qualifiedLeads || 0, icon: '✅', color: 'from-green-500 to-green-600', trend: '+8%' },
                { title: 'Conversion Rate', value: `${conversionRate.toFixed(1)}%`, icon: '🎯', color: 'from-orange-500 to-orange-600', trend: '+2%' },
              ].map((card, idx) => (
                <div key={idx} className={`bg-gradient-to-br ${card.color} rounded-xl p-6 text-white shadow-lg transform hover:scale-105 transition-transform`}>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-3xl">{card.icon}</span>
                    <span className="text-xs bg-white bg-opacity-20 px-2 py-1 rounded-full">{card.trend}</span>
                  </div>
                  <p className="text-sm opacity-90">{card.title}</p>
                  <p className="text-3xl font-bold mt-2">{card.value}</p>
                </div>
              ))}
            </div>

            {/* Left Sidebar: Recent Activity | Right: Funnel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Recent Activity */}
              <div className="lg:col-span-1 bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">📋 Recent Activity</h3>
                <div className="space-y-3">
                  {activities.length === 0 ? (
                    <p className="text-slate-500 text-sm">No recent activity</p>
                  ) : (
                    activities.slice(0, 5).map((activity, idx) => (
                      <div key={idx} className="flex gap-3 pb-3 border-b border-slate-100 last:border-b-0">
                        <span className="text-xl flex-shrink-0">{getStatusIcon(activity.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{activity.leadName}</p>
                          <p className="text-xs text-slate-500">{activity.details}</p>
                          <p className="text-xs text-slate-400 mt-1">{activity.timestamp.toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Conversion Funnel */}
              <div className="lg:col-span-2 bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-4">🔄 Conversion Funnel</h3>
                {stats ? (
                  <div className="space-y-4">
                    {[
                      { stage: 'All Leads', count: stats.totalLeads, pct: 100, color: 'from-blue-600 to-blue-400' },
                      { stage: 'Contacted', count: stats.contactedLeads, pct: stats.totalLeads > 0 ? (stats.contactedLeads / stats.totalLeads) * 100 : 0, color: 'from-purple-600 to-purple-400' },
                      { stage: 'Interested', count: stats.interestedLeads, pct: stats.totalLeads > 0 ? (stats.interestedLeads / stats.totalLeads) * 100 : 0, color: 'from-yellow-600 to-yellow-400' },
                      { stage: 'Qualified', count: stats.qualifiedLeads, pct: stats.totalLeads > 0 ? (stats.qualifiedLeads / stats.totalLeads) * 100 : 0, color: 'from-green-600 to-green-400' },
                    ].map((item, idx) => (
                      <div key={idx}>
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-semibold text-slate-900">{item.stage}</div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900">{item.count}</div>
                            <div className="text-xs text-slate-500">{item.pct.toFixed(1)}%</div>
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`h-full bg-gradient-to-r ${item.color} transition-all duration-700`}
                            style={{ width: `${item.pct}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-slate-600 text-sm font-medium mb-2">Pipeline Value</p>
                <p className="text-3xl font-bold text-slate-900">{pipelineValue}</p>
                <p className="text-xs text-slate-500 mt-2">Total leads in pipeline</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-slate-600 text-sm font-medium mb-2">Lost Deals</p>
                <p className="text-3xl font-bold text-red-600">{stats?.lostLeads || 0}</p>
                <p className="text-xs text-slate-500 mt-2">Needs follow-up</p>
              </div>
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-slate-600 text-sm font-medium mb-2">Verified Leads</p>
                <p className="text-3xl font-bold text-green-600">{leads.filter(l => l.verified).length}</p>
                <p className="text-xs text-slate-500 mt-2">Ready to convert</p>
              </div>
            </div>
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === 'leads' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            {/* Search & Filter */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="md:col-span-2">
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="interested">Interested</option>
                <option value="qualified">Qualified</option>
                <option value="lost">Lost</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="recent">Most Recent</option>
                <option value="status">By Status</option>
                <option value="name">By Name</option>
              </select>
            </div>

            {/* Leads Table */}
            {filteredLeads.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-600 text-lg">No leads found</p>
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
                      <th className="px-6 py-4 text-left font-semibold">Verified</th>
                      <th className="px-6 py-4 text-left font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredLeads.map((lead) => (
                      <tr key={lead._id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-semibold text-slate-900">{lead.name}</p>
                          <p className="text-sm text-slate-600">{lead.email}</p>
                        </td>
                        <td className="px-6 py-4 text-slate-600">{lead.phone}</td>
                        <td className="px-6 py-4">
                          <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">{lead.tripName}</span>
                        </td>
                        <td className="px-6 py-4">
                          <select
                            value={lead.status}
                            onChange={(e) => updateLeadStatus(lead._id, e.target.value)}
                            className={`px-3 py-2 rounded-lg font-medium border-2 cursor-pointer transition-colors ${getStatusColor(lead.status)}`}
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="interested">Interested</option>
                            <option value="qualified">Qualified</option>
                            <option value="lost">Lost</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          {lead.verified ? (
                            <span className="text-green-600 font-semibold">✅ Verified</span>
                          ) : (
                            <button
                              onClick={() => verifyLead(lead._id)}
                              className="text-blue-600 hover:text-blue-800 font-semibold"
                            >
                              Verify
                            </button>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setEditingNote(lead.notes);
                              setShowModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-2xl font-bold text-slate-900 mb-6">📊 Analytics Overview</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Lead Distribution Chart Placeholder */}
              <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-xl p-8 border-2 border-dashed border-slate-300">
                <h4 className="font-bold text-slate-900 mb-4">Lead Distribution</h4>
                <div className="space-y-4">
                  {stats ? [
                    { label: 'New', value: stats.newLeads, color: 'bg-blue-500' },
                    { label: 'Contacted', value: stats.contactedLeads, color: 'bg-purple-500' },
                    { label: 'Interested', value: stats.interestedLeads, color: 'bg-yellow-500' },
                    { label: 'Qualified', value: stats.qualifiedLeads, color: 'bg-green-500' },
                    { label: 'Lost', value: stats.lostLeads, color: 'bg-red-500' },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${item.color}`}></div>
                      <span className="font-medium text-slate-700 w-20">{item.label}</span>
                      <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div className={`${item.color} h-full`} style={{ width: `${(item.value / (stats.totalLeads || 1)) * 100}%` }}></div>
                      </div>
                      <span className="font-bold text-slate-900 w-12 text-right">{item.value}</span>
                    </div>
                  )) : null}
                </div>
              </div>

              {/* Trends Placeholder */}
              <div className="bg-gradient-to-br from-slate-50 to-green-50 rounded-xl p-8 border-2 border-dashed border-slate-300">
                <h4 className="font-bold text-slate-900 mb-4">Leads Over Time (Last 7 Days)</h4>
                <div className="space-y-2">
                  {leadsOverTime.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="text-sm text-slate-600 w-16">{new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      <div className="flex-1 bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div className="bg-gradient-to-r from-green-500 to-green-400 h-full" style={{ width: `${(item.count / 20) * 100}%` }}></div>
                      </div>
                      <span className="text-sm font-bold text-slate-900 w-8 text-right">{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lead Details Modal */}
      {showModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-2xl font-bold text-slate-900 mb-4">{selectedLead.name}</h3>
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-slate-600">Email</p>
                <p className="font-medium text-slate-900">{selectedLead.email}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Phone</p>
                <p className="font-medium text-slate-900">{selectedLead.phone}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">Trip</p>
                <p className="font-medium text-slate-900">{selectedLead.tripName}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600 mb-2">Notes</p>
                <textarea
                  value={editingNote}
                  onChange={(e) => setEditingNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
              >
                Close
              </button>
              <button
                onClick={handleSaveNote}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalCRMDashboard;
