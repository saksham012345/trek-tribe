import React, { useState, useEffect } from 'react';
import api from '../config/api';
import { User } from '../types';
import SubscriptionCard from '../components/crm/SubscriptionCard';
import { useToast } from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';
import BankDetailsTab from '../components/crm/BankDetailsTab';

// Payments Tab Component
const PaymentsTab: React.FC<{ user: User }> = ({ user }) => {
  const { add } = useToast();
  const [payments, setPayments] = useState<any[]>([]);
  const [verificationHistory, setVerificationHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'subscription' | 'verification'>('subscription');

  useEffect(() => {
    fetchPayments();
    fetchVerificationHistory();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await api.get('/api/subscriptions/payment-history');
      setPayments(response.data?.payments || []);
    } catch (error: any) {
      console.error('Failed to fetch payments:', error);
      if (error?.response?.status !== 401) {
        add('Failed to load payment history', 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchVerificationHistory = async () => {
    try {
      const response = await api.get('/api/payment-verification/history');
      setVerificationHistory(response.data?.history || []);
    } catch (error: any) {
      console.error('Failed to fetch verification history:', error);
      // Don't show error for 401 or if endpoint doesn't exist
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-300 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">Loading payment history...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="mb-6 flex gap-4 border-b border-gray-200">
        <button
          onClick={() => setActiveView('subscription')}
          className={`px-6 py-3 font-semibold transition-colors ${activeView === 'subscription'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          💳 Subscription Payments
        </button>
        <button
          onClick={() => setActiveView('verification')}
          className={`px-6 py-3 font-semibold transition-colors ${activeView === 'verification'
              ? 'text-blue-600 border-b-2 border-blue-600'
              : 'text-gray-600 hover:text-gray-900'
            }`}
        >
          ✅ Verified Payments
        </button>
      </div>

      {activeView === 'subscription' && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-6">Razorpay Subscription Payments</h3>
          {payments.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl">💳</span>
              <p className="text-gray-500 mt-4">No subscription payments yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Plan</th>
                    <th className="px-6 py-4 text-left font-semibold">Amount</th>
                    <th className="px-6 py-4 text-left font-semibold">Status</th>
                    <th className="px-6 py-4 text-left font-semibold">Date</th>
                    <th className="px-6 py-4 text-left font-semibold">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {payments.map((payment: any) => (
                    <tr key={payment.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900 capitalize">{payment.plan || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-bold text-green-600">₹{payment.amount?.toLocaleString() || '0'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${payment.status === 'active' ? 'bg-green-100 text-green-800' :
                            payment.status === 'trial' ? 'bg-blue-100 text-blue-800' :
                              payment.status === 'expired' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                          }`}>
                          {payment.status || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        {payment.isTrial ? (
                          <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">Trial</span>
                        ) : (
                          <span className="px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-sm font-medium">Paid</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeView === 'verification' && (
        <div>
          <h3 className="text-xl font-bold text-gray-900 mb-6">QR Code Verified Payments</h3>
          {verificationHistory.length === 0 ? (
            <div className="text-center py-12">
              <span className="text-4xl">✅</span>
              <p className="text-gray-500 mt-4">No verified payments yet</p>
              <p className="text-sm text-gray-400 mt-2">Payments verified via QR codes will appear here</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold">Amount</th>
                    <th className="px-6 py-4 text-left font-semibold">Payment Method</th>
                    <th className="px-6 py-4 text-left font-semibold">Transaction ID</th>
                    <th className="px-6 py-4 text-left font-semibold">Verified At</th>
                    <th className="px-6 py-4 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {verificationHistory.map((payment: any, idx: number) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-bold text-green-600">
                          ₹{payment.amount?.toLocaleString() || '0'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-700 capitalize">{payment.paymentMethod || 'UPI'}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-mono text-sm text-gray-600">{payment.transactionId || 'N/A'}</span>
                      </td>
                      <td className="px-6 py-4 text-gray-600">
                        {payment.verifiedAt ? new Date(payment.verifiedAt).toLocaleString('en-IN') : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${payment.status === 'verified' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                          {payment.status || 'Verified'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

interface OrganizerCRMProps {
  user: User;
}

interface Analytics {
  trips: { total: number; active: number; completed: number; verified: number };
  leads: { total: number; contacted: number; converted: number; conversionRate: number };
  revenue: { total: number; thisMonth: number; lastMonth: number };
  performance: { averageRating: number; totalReviews: number; responseTime: string };
}

interface Lead {
  _id: string;
  tripId: { _id: string; title: string };
  travelerId: { name: string; email: string; phone?: string };
  status: string;
  message: string;
  createdAt: string;
}

interface Ticket {
  _id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  lastUpdated: string;
}

const OrganizerCRMDashboard: React.FC<OrganizerCRMProps> = ({ user }) => {
  const { add } = useToast();
  const [activeTab, setActiveTab] = useState('overview');
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, [activeTab]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview' || activeTab === 'analytics') {
        const response = await api.get('/api/analytics/dashboard');
        setAnalytics(response.data);
      }
      if (activeTab === 'leads') {
        const response = await api.get('/api/crm/leads');
        setLeads(response.data.data || response.data.leads || []);
      }
      if (activeTab === 'tickets') {
        const response = await api.get('/api/crm/tickets');
        setTickets(response.data.data || response.data.tickets || []);
      }
    } catch (error: any) {
      console.error('Error fetching dashboard data:', error);
      add(error.response?.data?.error || 'Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: '📊' },
    { id: 'analytics', name: 'Analytics', icon: '📈' },
    { id: 'subscription', name: 'Subscription', icon: '💳' },
    { id: 'bank-details', name: 'Bank Details', icon: '🏦' },
    { id: 'leads', name: 'Leads', icon: '🎯' },
    { id: 'tickets', name: 'Support', icon: '🎫' },
    { id: 'payments', name: 'Payments', icon: '💰' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                🏢 Organizer CRM
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Welcome back, <span className="font-semibold">{user.name}</span>
              </p>
            </div>
            <button
              onClick={() => setShowUpgradeModal(true)}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all shadow-md"
            >
              👑 Upgrade to Premium
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 py-4 px-2 border-b-2 font-medium text-sm whitespace-nowrap transition-all ${activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
              >
                <span>{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Subscription Card */}
            <div className="lg:col-span-1">
              <SubscriptionCard onUpgrade={() => setShowUpgradeModal(true)} />
            </div>

            {/* Quick Stats */}
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Trips</p>
                    <p className="text-3xl font-bold text-blue-600 mt-1">
                      {analytics?.trips.active || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-blue-100 rounded-full">
                    <span className="text-3xl">🗺️</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Total Leads</p>
                    <p className="text-3xl font-bold text-green-600 mt-1">
                      {analytics?.leads.total || 0}
                    </p>
                  </div>
                  <div className="p-4 bg-green-100 rounded-full">
                    <span className="text-3xl">🎯</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">This Month Revenue</p>
                    <p className="text-3xl font-bold text-purple-600 mt-1">
                      ₹{(analytics?.revenue.thisMonth || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="p-4 bg-purple-100 rounded-full">
                    <span className="text-3xl">💰</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Conversion Rate</p>
                    <p className="text-3xl font-bold text-orange-600 mt-1">
                      {analytics?.leads.conversionRate?.toFixed(1) || 0}%
                    </p>
                  </div>
                  <div className="p-4 bg-orange-100 rounded-full">
                    <span className="text-3xl">📊</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="lg:col-span-3 bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">📋 Recent Activity</h3>
              <div className="space-y-3">
                {[1, 2, 3].map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">New lead inquiry</p>
                      <p className="text-xs text-gray-500">{i + 1} hours ago</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600">Total Trips</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">
                  {analytics?.trips.total || 0}
                </p>
                <p className="text-xs text-green-600 mt-1">↑ 12% from last month</p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600">Verified Trips</p>
                <p className="text-3xl font-bold text-green-600 mt-2">
                  {analytics?.trips.verified || 0}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {((analytics?.trips.verified || 0) / (analytics?.trips.total || 1) * 100).toFixed(0)}% verified
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600">Lead Conversion</p>
                <p className="text-3xl font-bold text-blue-600 mt-2">
                  {analytics?.leads.conversionRate?.toFixed(1) || 0}%
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {analytics?.leads.converted || 0} of {analytics?.leads.total || 0} leads
                </p>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <p className="text-sm text-gray-600">Average Rating</p>
                <p className="text-3xl font-bold text-amber-600 mt-2">
                  {analytics?.performance.averageRating?.toFixed(1) || 0}⭐
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {analytics?.performance.totalReviews || 0} reviews
                </p>
              </div>
            </div>

            {/* Revenue Chart Placeholder */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">📈 Revenue Trend</h3>
              <div className="h-64 flex items-center justify-center bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg">
                <p className="text-gray-500">Revenue chart coming soon...</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'subscription' && (
          <div className="max-w-4xl mx-auto">
            <SubscriptionCard onUpgrade={() => setShowUpgradeModal(true)} />

            {/* Subscription Plans */}
            <div className="mt-8 grid md:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200">
                <h3 className="text-xl font-bold text-gray-900 mb-2">📦 Basic Plan</h3>
                <p className="text-3xl font-bold text-gray-900 mb-4">₹1,499<span className="text-sm text-gray-500">/60 days</span></p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <span>5 Trip Posts</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <span>Basic Analytics</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="text-green-500">✓</span>
                    <span>Email Support</span>
                  </li>
                </ul>
                <button className="w-full bg-gray-600 text-white py-2 rounded-lg font-semibold">
                  Current Plan
                </button>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-xl shadow-lg p-6 border-2 border-amber-300">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xl font-bold text-gray-900">👑 Premium Plan</h3>
                  <span className="px-2 py-1 bg-amber-200 text-amber-800 text-xs font-bold rounded">RECOMMENDED</span>
                </div>
                <p className="text-3xl font-bold text-gray-900 mb-4">₹2,100<span className="text-sm text-gray-500">/60 days</span></p>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2 text-sm">
                    <span className="text-amber-600">✓</span>
                    <span>10 Trip Posts</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="text-amber-600">✓</span>
                    <span>Full CRM Access</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="text-amber-600">✓</span>
                    <span>AI Tools & Insights</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="text-amber-600">✓</span>
                    <span>Priority Support</span>
                  </li>
                  <li className="flex items-center gap-2 text-sm">
                    <span className="text-amber-600">✓</span>
                    <span>Advanced Analytics</span>
                  </li>
                </ul>
                <button
                  onClick={() => setShowUpgradeModal(true)}
                  className="w-full bg-gradient-to-r from-amber-600 to-yellow-600 text-white py-2 rounded-lg font-semibold hover:from-amber-700 hover:to-yellow-700 transition-all"
                >
                  Upgrade Now
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'leads' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">🎯 Lead Management</h3>
              <select className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option>All Leads</option>
                <option>New</option>
                <option>Contacted</option>
                <option>Converted</option>
              </select>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : leads.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl">📭</span>
                <p className="text-gray-500 mt-4">No leads yet</p>
              </div>
            ) : (
              <div className="space-y-4">
                {leads.map((lead) => (
                  <div key={lead._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{lead.travelerId.name}</p>
                        <p className="text-sm text-gray-600">{lead.tripId.title}</p>
                      </div>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${lead.status === 'new' ? 'bg-blue-100 text-blue-800' :
                          lead.status === 'contacted' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-green-100 text-green-800'
                        }`}>
                        {lead.status.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 mb-2">{lead.message}</p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>📧 {lead.travelerId.email}</span>
                      <span>{new Date(lead.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'tickets' && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">🎫 Support Tickets</h3>
              <button className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-blue-700">
                New Ticket
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : tickets.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl">🎫</span>
                <p className="text-gray-500 mt-4">No support tickets</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tickets.map((ticket) => (
                  <div key={ticket._id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">{ticket.subject}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Created: {new Date(ticket.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ticket.priority === 'high' ? 'bg-red-100 text-red-800' :
                            ticket.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-green-100 text-green-800'
                          }`}>
                          {ticket.priority}
                        </span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${ticket.status === 'open' ? 'bg-blue-100 text-blue-800' :
                            ticket.status === 'in_progress' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                          }`}>
                          {ticket.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'payments' && (
          <PaymentsTab user={user} />
        )}

        {activeTab === 'bank-details' && (
          <BankDetailsTab />
        )}
      </div>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">👑 Upgrade to Premium</h3>
            <p className="text-gray-600 mb-6">
              Get access to advanced CRM features, AI insights, and priority support.
            </p>
            <div className="space-y-4 mb-6">
              <p className="text-3xl font-bold text-gray-900">₹2,100<span className="text-sm text-gray-500">/60 days</span></p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUpgradeModal(false)}
                className="flex-1 bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold hover:bg-gray-300"
              >
                Cancel
              </button>
              <button className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700">
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrganizerCRMDashboard;
