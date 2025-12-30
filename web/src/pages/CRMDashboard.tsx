import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { useToast, ToastContainer } from '../components/Toast';
import { Skeleton } from '../components/ui/Skeleton';
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
}

interface CRMStats {
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  interestedLeads: number;
  qualifiedLeads: number;
  lostLeads: number;
  conversionRate: number;
  revenue?: {
    total: number;
    thisMonth: number;
    lastMonth: number;
    growth: number;
    averageBookingValue: number;
  };
  bookings?: {
    total: number;
    confirmed: number;
    pending: number;
  };
  trips?: {
    total: number;
    active: number;
  };
}

const CRMDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { showToast, toasts, removeToast, success } = useToast();

  const [hasCRMAccess, setHasCRMAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<CRMStats | null>(null);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics'>('dashboard');
  
  // Analytics data (ADD-ONLY, non-breaking)
  const [bookingsOverTime, setBookingsOverTime] = useState<Array<{ date: string; bookings: number; revenue: number }>>([]);
  const [paymentStatusData, setPaymentStatusData] = useState<Array<{ status: string; count: number }>>([]);
  const [revenuePerTrip, setRevenuePerTrip] = useState<Array<{ tripId: string; tripName: string; revenue: number; bookings: number }>>([]);
  const [leadSourcesData, setLeadSourcesData] = useState<Array<{ source: string; count: number; converted: number; conversionRate: string }>>([]);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Check CRM access - wait for auth to complete first
  useEffect(() => {
    if (!authLoading) {
      checkCRMAccess();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user]);

  const checkCRMAccess = async () => {
    // Don't check if user is not logged in
    if (!user) {
      console.log('⚠️ No user found, redirecting to login');
      navigate('/login');
      return;
    }
    try {
      console.log('🔍 Checking CRM access...');
      const response = await api.get('/api/subscriptions/verify-crm-access');
      console.log('📊 CRM access response:', response.data);
      
      if (response.data.hasCRMAccess) {
        setHasCRMAccess(true);
        console.log('✅ CRM access granted, fetching data...');
        await Promise.all([fetchLeads(), fetchStats()]);
        // Fetch analytics data if on analytics tab (non-blocking)
        if (activeTab === 'analytics') {
          fetchAnalyticsData();
        }
      } else {
        console.log('❌ CRM access denied:', response.data.message || response.data.accessDeniedReason);
        setHasCRMAccess(false);
        showToast(response.data.message || 'CRM access not available. Please upgrade your plan.', 'error');
      }
    } catch (error: any) {
      console.error('❌ Failed to check CRM access:', error);
      console.error('   Status:', error.response?.status);
      console.error('   Data:', error.response?.data);
      
      // Handle 401 specifically - user not authenticated
      if (error.response?.status === 401) {
        showToast('Please log in to access CRM', 'error');
        setHasCRMAccess(false);
      } else if (error.response?.status === 403) {
        showToast(error.response?.data?.message || 'CRM access denied. Please upgrade your plan.', 'error');
        setHasCRMAccess(false);
      } else {
        showToast('Failed to verify CRM access. Please try again.', 'error');
        setHasCRMAccess(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLeads = async () => {
    try {
      console.log('📥 Fetching CRM leads...');
      const response = await api.get('/api/crm/leads');
      console.log('📊 Leads response:', response.data);
      // Backend returns { success: true, data: leads, pagination: {...} }
      // Handle both formats for compatibility
      const leadsData = response.data.data || response.data.leads || [];
      
      // Transform leads to match expected format
      const formattedLeads = leadsData.map((lead: any) => ({
        _id: lead._id,
        name: lead.name || '',
        email: lead.email || '',
        phone: lead.phone || '',
        tripId: lead.tripId?._id || lead.tripId || '',
        tripName: lead.tripId?.title || lead.tripName || 'Unknown Trip',
        status: lead.status || 'new',
        createdAt: lead.createdAt || new Date().toISOString(),
        notes: lead.notes || '',
        verified: lead.verified || false,
      }));
      
      setLeads(formattedLeads);
      console.log('✅ Leads fetched:', formattedLeads.length);
    } catch (error: any) {
      console.error('❌ Failed to fetch leads:', error);
      console.error('   Status:', error.response?.status);
      console.error('   Data:', error.response?.data);
      if (error.response?.status === 401) {
        showToast('Please log in to view leads', 'error');
        // Don't clear leads on 401 - might be temporary auth issue
      } else {
        showToast('Failed to load leads', 'error');
      }
      // Keep existing leads if fetch fails (don't clear them)
      // setLeads([]);
    }
  };

  const fetchStats = async () => {
    try {
      // Try to fetch stats from dedicated endpoint
      console.log('📥 Fetching CRM stats...');
      const response = await api.get('/api/crm/stats');
      console.log('📊 Stats response:', response.data);
      setStats(response.data);
    } catch (error: any) {
      console.error('Failed to fetch stats from endpoint:', error);
      
      // Fallback: Calculate stats from leads
      try {
        const leadsResponse = await api.get('/api/crm/leads');
        const leadsData = leadsResponse.data.data || leadsResponse.data.leads || [];
        
        const calculatedStats: CRMStats = {
          totalLeads: leadsData.length,
          newLeads: leadsData.filter((l: any) => l.status === 'new').length,
          contactedLeads: leadsData.filter((l: any) => l.status === 'contacted').length,
          interestedLeads: leadsData.filter((l: any) => l.status === 'interested').length,
          qualifiedLeads: leadsData.filter((l: any) => l.status === 'qualified').length,
          lostLeads: leadsData.filter((l: any) => l.status === 'lost').length,
          conversionRate: leadsData.length > 0 
            ? (leadsData.filter((l: any) => l.status === 'qualified').length / leadsData.length) * 100 
            : 0,
          revenue: {
            total: 0,
            thisMonth: 0,
            lastMonth: 0,
            growth: 0,
            averageBookingValue: 0,
          },
          bookings: {
            total: 0,
            confirmed: 0,
            pending: 0,
          },
          trips: {
            total: 0,
            active: 0,
          },
        };
        
        setStats(calculatedStats);
      } catch (fallbackError: any) {
        console.error('Failed to calculate stats from leads:', fallbackError);
        // Set default empty stats
        setStats({
          totalLeads: 0,
          newLeads: 0,
          contactedLeads: 0,
          interestedLeads: 0,
          qualifiedLeads: 0,
          lostLeads: 0,
          conversionRate: 0,
          revenue: {
            total: 0,
            thisMonth: 0,
            lastMonth: 0,
            growth: 0,
            averageBookingValue: 0,
          },
          bookings: {
            total: 0,
            confirmed: 0,
            pending: 0,
          },
          trips: {
            total: 0,
            active: 0,
          },
        });
      }
    }
  };

  const updateLeadStatus = async (leadId: string, newStatus: string) => {
    try {
      await api.put(`/api/crm/leads/${leadId}`, { status: newStatus });
      fetchLeads();
      fetchStats(); // Refresh stats after status update
      showToast('Lead status updated!', 'success');
    } catch (error: any) {
      showToast('Failed to update lead status', 'error');
    }
  };

  const updateLeadNote = async (leadId: string) => {
    try {
      await api.put(`/api/crm/leads/${leadId}`, { notes: editingNote });
      fetchLeads();
      setEditingNote('');
      showToast('Note updated!', 'success');
    } catch (error: any) {
      showToast('Failed to update note', 'error');
    }
  };

  const verifyLead = async (leadId: string) => {
    try {
      await api.post(`/api/crm/leads/${leadId}/verify`);
      fetchLeads();
      showToast('Lead verified!', 'success');
    } catch (error: any) {
      showToast('Failed to verify lead', 'error');
    }
  };

  // Analytics data fetching (ADD-ONLY, non-breaking enhancement)
  const fetchAnalyticsData = async () => {
    setAnalyticsLoading(true);
    try {
      const [bookingsRes, paymentRes, revenueRes, sourcesRes] = await Promise.all([
        api.get('/api/crm/analytics/bookings-over-time?days=30').catch(() => ({ data: { success: false } })),
        api.get('/api/crm/analytics/payment-status').catch(() => ({ data: { success: false } })),
        api.get('/api/crm/analytics/revenue-per-trip').catch(() => ({ data: { success: false } })),
        api.get('/api/crm/analytics/lead-sources').catch(() => ({ data: { success: false } })),
      ]);

      if (bookingsRes.data.success) {
        setBookingsOverTime(bookingsRes.data.data || []);
      }
      if (paymentRes.data.success) {
        setPaymentStatusData(paymentRes.data.data || []);
      }
      if (revenueRes.data.success) {
        setRevenuePerTrip(revenueRes.data.data || []);
      }
      if (sourcesRes.data.success) {
        setLeadSourcesData(sourcesRes.data.data || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch analytics data:', error);
      // Fail gracefully - don't break existing functionality
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Fetch analytics when tab changes
  useEffect(() => {
    if (hasCRMAccess && activeTab === 'analytics') {
      fetchAnalyticsData();
    }
  }, [activeTab, hasCRMAccess]);

  const filteredLeads = leads.filter(lead => {
    const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
    const matchesSearch = 
      lead.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.phone.includes(searchQuery);
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow p-6">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-2 h-8 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="mt-2 h-4 w-96" />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-xl shadow p-6">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="mt-2 h-8 w-24" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Show access denied message with sample CRM preview
  if (!hasCRMAccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-forest-50 to-nature-50 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          {/* Locked Header */}
          <div className="text-center mb-8">
            <div className="mb-6">
              <svg className="w-16 h-16 text-forest-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-forest-900 mb-2">CRM Access Locked</h1>
            <p className="text-forest-600 mb-6">
              CRM features are only available with Professional or higher plans. Upgrade now to start managing leads!
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/subscribe')}
                className="bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold px-6 py-3 rounded-xl hover:from-forest-700 hover:to-nature-700 transition-all"
              >
                Upgrade Plan
              </button>
              <button
                onClick={() => {
                  setLoading(true);
                  checkCRMAccess();
                }}
                className="border-2 border-forest-300 text-forest-700 font-semibold px-6 py-3 rounded-xl hover:bg-forest-50 transition-all"
              >
                Retry Access Check
              </button>
            </div>
          </div>

          {/* Sample CRM Preview */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 opacity-75 relative">
            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm rounded-2xl flex items-center justify-center z-10">
              <div className="text-center">
                <svg className="w-12 h-12 text-forest-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-forest-700 font-semibold">Preview Only - Upgrade to Unlock</p>
              </div>
            </div>
            
            <h2 className="text-2xl font-bold text-forest-900 mb-6">CRM Dashboard Preview</h2>
            
            {/* Sample Stats */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-md p-6 border-l-4 border-green-600">
                <p className="text-green-600 text-sm font-semibold">Total Revenue</p>
                <p className="text-3xl font-bold text-green-900 mt-1">₹45,000</p>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-6 border-l-4 border-blue-600">
                <p className="text-blue-600 text-sm font-semibold">Total Leads</p>
                <p className="text-3xl font-bold text-blue-900 mt-1">127</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-md p-6 border-l-4 border-purple-600">
                <p className="text-purple-600 text-sm font-semibold">Conversion Rate</p>
                <p className="text-3xl font-bold text-purple-900 mt-1">68%</p>
              </div>
            </div>

            {/* Sample Leads Table */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-forest-600 to-nature-600 text-white px-6 py-4">
                <h3 className="text-lg font-semibold">Recent Leads</h3>
              </div>
              <table className="w-full">
                <thead className="bg-forest-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-forest-700">Name</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-forest-700">Email</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-forest-700">Trip</th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-forest-700">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-200">
                  <tr className="bg-white">
                    <td className="px-6 py-4 font-medium text-forest-900">Rajesh Kumar</td>
                    <td className="px-6 py-4 text-forest-700">rajesh@example.com</td>
                    <td className="px-6 py-4 text-forest-700">Himalayan Trek</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">Qualified</span>
                    </td>
                  </tr>
                  <tr className="bg-forest-50">
                    <td className="px-6 py-4 font-medium text-forest-900">Priya Sharma</td>
                    <td className="px-6 py-4 text-forest-700">priya@example.com</td>
                    <td className="px-6 py-4 text-forest-700">Mountain Expedition</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">Contacted</span>
                    </td>
                  </tr>
                  <tr className="bg-white">
                    <td className="px-6 py-4 font-medium text-forest-900">Amit Singh</td>
                    <td className="px-6 py-4 text-forest-700">amit@example.com</td>
                    <td className="px-6 py-4 text-forest-700">Adventure Camp</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">New</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Upgrade CTA */}
            <div className="mt-6 text-center">
              <button
                onClick={() => navigate('/subscribe')}
                className="bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold px-8 py-3 rounded-xl hover:from-forest-700 hover:to-nature-700 transition-all shadow-lg"
              >
                Unlock Full CRM Access - Upgrade Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="min-h-screen bg-gradient-to-br from-forest-50 via-nature-50 to-forest-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-forest-900 mb-2">CRM Dashboard</h1>
              <p className="text-forest-600">Manage leads and build customer relationships</p>
            </div>
            <button
              onClick={() => {
                fetchLeads();
                fetchStats();
                if (activeTab === 'analytics') {
                  fetchAnalyticsData();
                }
                showToast('Dashboard refreshed!', 'success');
              }}
              className="px-4 py-2 bg-forest-600 text-white rounded-lg hover:bg-forest-700 transition-colors flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>

          {/* Tabs (ADD-ONLY enhancement) */}
          <div className="mb-6 flex gap-2 border-b border-forest-200">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'dashboard'
                  ? 'text-forest-900 border-b-2 border-forest-600'
                  : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              Dashboard
            </button>
            <button
              onClick={() => setActiveTab('analytics')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'analytics'
                  ? 'text-forest-900 border-b-2 border-forest-600'
                  : 'text-forest-600 hover:text-forest-900'
              }`}
            >
              Analytics
            </button>
          </div>

          {/* Dashboard Tab Content */}
          {activeTab === 'dashboard' && (
            <>
              {/* Stats Cards */}
              {stats ? (
                <>
                  {/* Revenue & Business Metrics */}
                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg shadow-md p-6 border-l-4 border-green-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 text-sm font-semibold">Total Revenue</p>
                      <p className="text-3xl font-bold text-green-900 mt-1">
                        ₹{stats.revenue?.total?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                      </p>
                    </div>
                    <svg className="w-12 h-12 text-green-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg shadow-md p-6 border-l-4 border-blue-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 text-sm font-semibold">This Month</p>
                      <p className="text-3xl font-bold text-blue-900 mt-1">
                        ₹{stats.revenue?.thisMonth?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                      </p>
                      {stats.revenue?.growth !== undefined && (
                        <p className={`text-xs mt-1 font-semibold ${stats.revenue.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {stats.revenue.growth >= 0 ? '↑' : '↓'} {Math.abs(stats.revenue.growth).toFixed(1)}% vs last month
                        </p>
                      )}
                    </div>
                    <svg className="w-12 h-12 text-blue-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg shadow-md p-6 border-l-4 border-purple-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-600 text-sm font-semibold">Total Bookings</p>
                      <p className="text-3xl font-bold text-purple-900 mt-1">{stats.bookings?.total || 0}</p>
                      <p className="text-xs text-purple-600 mt-1">
                        {stats.bookings?.confirmed || 0} confirmed
                      </p>
                    </div>
                    <svg className="w-12 h-12 text-purple-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                  </div>
                </div>
                <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-lg shadow-md p-6 border-l-4 border-indigo-600">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-indigo-600 text-sm font-semibold">Avg Booking Value</p>
                      <p className="text-3xl font-bold text-indigo-900 mt-1">
                        ₹{stats.revenue?.averageBookingValue?.toLocaleString('en-IN', { maximumFractionDigits: 0 }) || '0'}
                      </p>
                    </div>
                    <svg className="w-12 h-12 text-indigo-400 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Lead Metrics */}
              <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
                <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-forest-600">
                  <p className="text-forest-600 text-sm font-semibold">Total Leads</p>
                  <p className="text-3xl font-bold text-forest-900 mt-1">{stats.totalLeads}</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-blue-600">
                  <p className="text-forest-600 text-sm font-semibold">New</p>
                  <p className="text-3xl font-bold text-blue-600 mt-1">{stats.newLeads}</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-yellow-600">
                  <p className="text-forest-600 text-sm font-semibold">Contacted</p>
                  <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.contactedLeads}</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-orange-600">
                  <p className="text-forest-600 text-sm font-semibold">Interested</p>
                  <p className="text-3xl font-bold text-orange-600 mt-1">{stats.interestedLeads}</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-green-600">
                  <p className="text-forest-600 text-sm font-semibold">Qualified</p>
                  <p className="text-3xl font-bold text-green-600 mt-1">{stats.qualifiedLeads}</p>
                </div>
                <div className="bg-white rounded-lg shadow-md p-4 border-l-4 border-nature-600">
                  <p className="text-forest-600 text-sm font-semibold">Conversion</p>
                  <p className="text-3xl font-bold text-nature-600 mt-1">{Math.round(stats.conversionRate)}%</p>
                </div>
              </div>
            </>
          ) : (
            // Show placeholder when stats are loading
            <div className="bg-white rounded-xl shadow-md p-6 mb-8">
              <div className="text-center py-8">
                <p className="text-forest-600">Loading statistics...</p>
              </div>
            </div>
          )}

                  {/* Search & Filter */}
                  <div className="bg-white rounded-xl shadow-md p-6 mb-8">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-forest-700 mb-2">
                  Search Leads
                </label>
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-forest-200 rounded-lg focus:outline-none focus:border-nature-600"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-forest-700 mb-2">
                  Filter by Status
                </label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-2 border-2 border-forest-200 rounded-lg focus:outline-none focus:border-nature-600 bg-white"
                >
                  <option value="all">All Leads</option>
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="interested">Interested</option>
                  <option value="qualified">Qualified</option>
                  <option value="lost">Lost</option>
                </select>
              </div>
            </div>
          </div>

                  {/* Leads Table */}
                  <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-forest-600 to-nature-600 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Name</th>
                    <th className="px-6 py-4 text-left font-semibold">Email</th>
                    <th className="px-6 py-4 text-left font-semibold">Phone</th>
                    <th className="px-6 py-4 text-left font-semibold">Trip</th>
                    <th className="px-6 py-4 text-left font-semibold">Status</th>
                    <th className="px-6 py-4 text-left font-semibold">Verified</th>
                    <th className="px-6 py-4 text-left font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-forest-200">
                  {filteredLeads.length > 0 ? (
                    filteredLeads.map((lead, idx) => (
                      <tr key={lead._id} className={idx % 2 === 0 ? 'bg-white' : 'bg-forest-50'}>
                        <td className="px-6 py-4 font-medium text-forest-900">{lead.name}</td>
                        <td className="px-6 py-4 text-forest-700">{lead.email}</td>
                        <td className="px-6 py-4 text-forest-700">{lead.phone}</td>
                        <td className="px-6 py-4 text-forest-700">{lead.tripName}</td>
                        <td className="px-6 py-4">
                          <select
                            value={lead.status}
                            onChange={(e) => updateLeadStatus(lead._id, e.target.value)}
                            className={`px-3 py-1 rounded-full text-xs font-semibold border-2 focus:outline-none ${
                              lead.status === 'new'
                                ? 'bg-blue-100 border-blue-300 text-blue-700'
                                : lead.status === 'contacted'
                                ? 'bg-yellow-100 border-yellow-300 text-yellow-700'
                                : lead.status === 'interested'
                                ? 'bg-orange-100 border-orange-300 text-orange-700'
                                : lead.status === 'qualified'
                                ? 'bg-green-100 border-green-300 text-green-700'
                                : 'bg-red-100 border-red-300 text-red-700'
                            }`}
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
                            <span className="inline-flex items-center gap-1 text-green-700">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              Verified
                            </span>
                          ) : (
                            <button
                              onClick={() => verifyLead(lead._id)}
                              className="text-nature-600 hover:text-nature-700 font-semibold hover:underline"
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
                            className="text-forest-600 hover:text-forest-700 font-semibold hover:underline"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-forest-600">
                        <p className="text-lg font-semibold mb-2">No leads found</p>
                        <p className="text-sm">Leads will appear here as people inquire about your trips</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
                </>
              ) : (
                // Show placeholder when stats are loading
                <div className="bg-white rounded-xl shadow-md p-6 mb-8">
                  <div className="text-center py-8">
                    <p className="text-forest-600">Loading statistics...</p>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Analytics Tab Content (ADD-ONLY enhancement) */}
          {activeTab === 'analytics' && (
            <div className="space-y-8">
              {analyticsLoading ? (
                <div className="bg-white rounded-xl shadow-md p-6">
                  <div className="text-center py-8">
                    <p className="text-forest-600">Loading analytics...</p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Bookings Over Time Chart */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-2xl font-bold text-forest-900 mb-6">📈 Bookings Over Time (30 Days)</h3>
                    {bookingsOverTime.length > 0 ? (
                      <Line
                        data={{
                          labels: bookingsOverTime.map(d => new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })),
                          datasets: [
                            {
                              label: 'Bookings',
                              data: bookingsOverTime.map(d => d.bookings),
                              borderColor: 'rgb(34, 197, 94)',
                              backgroundColor: 'rgba(34, 197, 94, 0.1)',
                              tension: 0.4,
                              fill: true,
                            },
                            {
                              label: 'Revenue (₹)',
                              data: bookingsOverTime.map(d => d.revenue),
                              borderColor: 'rgb(59, 130, 246)',
                              backgroundColor: 'rgba(59, 130, 246, 0.1)',
                              tension: 0.4,
                              fill: true,
                              yAxisID: 'y1',
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { position: 'top' },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: { display: true, text: 'Bookings' },
                            },
                            y1: {
                              type: 'linear',
                              display: true,
                              position: 'right',
                              title: { display: true, text: 'Revenue (₹)' },
                              grid: { drawOnChartArea: false },
                            },
                          },
                        }}
                      />
                    ) : (
                      <p className="text-forest-600 text-center py-8">No booking data available</p>
                    )}
                  </div>

                  {/* Payment Status & Lead Sources */}
                  <div className="grid md:grid-cols-2 gap-8">
                    {/* Payment Status Pie Chart */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <h3 className="text-2xl font-bold text-forest-900 mb-6">🍩 Payment Status Breakdown</h3>
                      {paymentStatusData.length > 0 ? (
                        <Pie
                          data={{
                            labels: paymentStatusData.map(d => d.status.charAt(0).toUpperCase() + d.status.slice(1)),
                            datasets: [
                              {
                                data: paymentStatusData.map(d => d.count),
                                backgroundColor: [
                                  'rgba(34, 197, 94, 0.8)',
                                  'rgba(251, 191, 36, 0.8)',
                                  'rgba(239, 68, 68, 0.8)',
                                  'rgba(156, 163, 175, 0.8)',
                                ],
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: { position: 'bottom' },
                            },
                          }}
                        />
                      ) : (
                        <p className="text-forest-600 text-center py-8">No payment data available</p>
                      )}
                    </div>

                    {/* Lead Sources Pie Chart */}
                    <div className="bg-white rounded-xl shadow-lg p-6">
                      <h3 className="text-2xl font-bold text-forest-900 mb-6">🧭 Lead Source Distribution</h3>
                      {leadSourcesData.length > 0 ? (
                        <Pie
                          data={{
                            labels: leadSourcesData.map(d => d.source.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())),
                            datasets: [
                              {
                                data: leadSourcesData.map(d => d.count),
                                backgroundColor: [
                                  'rgba(59, 130, 246, 0.8)',
                                  'rgba(168, 85, 247, 0.8)',
                                  'rgba(236, 72, 153, 0.8)',
                                  'rgba(251, 146, 60, 0.8)',
                                  'rgba(34, 197, 94, 0.8)',
                                ],
                              },
                            ],
                          }}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: { position: 'bottom' },
                            },
                          }}
                        />
                      ) : (
                        <p className="text-forest-600 text-center py-8">No lead source data available</p>
                      )}
                    </div>
                  </div>

                  {/* Revenue Per Trip Bar Chart */}
                  <div className="bg-white rounded-xl shadow-lg p-6">
                    <h3 className="text-2xl font-bold text-forest-900 mb-6">📊 Revenue Per Trip</h3>
                    {revenuePerTrip.length > 0 ? (
                      <Bar
                        data={{
                          labels: revenuePerTrip.slice(0, 10).map(d => d.tripName.length > 30 ? d.tripName.substring(0, 30) + '...' : d.tripName),
                          datasets: [
                            {
                              label: 'Revenue (₹)',
                              data: revenuePerTrip.slice(0, 10).map(d => d.revenue),
                              backgroundColor: 'rgba(34, 197, 94, 0.8)',
                            },
                          ],
                        }}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { display: false },
                          },
                          scales: {
                            y: {
                              beginAtZero: true,
                              title: { display: true, text: 'Revenue (₹)' },
                            },
                          },
                        }}
                      />
                    ) : (
                      <p className="text-forest-600 text-center py-8">No revenue data available</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lead Details Modal */}
      {showModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-forest-900 mb-4">{selectedLead.name}</h2>

            <div className="space-y-4 mb-6">
              <div>
                <p className="text-sm text-forest-600 font-semibold">Email</p>
                <p className="text-forest-900">{selectedLead.email}</p>
              </div>
              <div>
                <p className="text-sm text-forest-600 font-semibold">Phone</p>
                <p className="text-forest-900">{selectedLead.phone}</p>
              </div>
              <div>
                <p className="text-sm text-forest-600 font-semibold">Interested Trip</p>
                <p className="text-forest-900">{selectedLead.tripName}</p>
              </div>
              <div>
                <p className="text-sm text-forest-600 font-semibold">Lead Date</p>
                <p className="text-forest-900">{new Date(selectedLead.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-forest-700 mb-2">Notes</label>
              <textarea
                value={editingNote}
                onChange={(e) => setEditingNote(e.target.value)}
                className="w-full px-4 py-2 border-2 border-forest-200 rounded-lg focus:outline-none focus:border-nature-600 resize-none"
                rows={3}
                placeholder="Add notes about this lead..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (selectedLead) {
                    updateLeadNote(selectedLead._id);
                    setShowModal(false);
                  }
                }}
                className="flex-1 bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold py-2 rounded-lg hover:from-forest-700 hover:to-nature-700 transition-all"
              >
                Save Note
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 border-2 border-forest-300 text-forest-700 font-semibold py-2 rounded-lg hover:bg-forest-50 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CRMDashboard;
