import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import api from '../config/api';

interface VerificationRequest {
  _id: string;
  organizerId: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
    createdAt: string;
    organizerProfile?: {
      bio?: string;
      experience?: string;
      yearsOfExperience?: number;
      specialties?: string[];
      trustScore?: {
        overall: number;
        breakdown: any;
      };
    };
  };
  organizerName: string;
  organizerEmail: string;
  requestType: 'initial' | 'document_update' | 're_verification';
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  priority: 'low' | 'medium' | 'high';
  documents: Array<{
    type: string;
    fileUrl: string;
    uploadedAt: string;
    verified: boolean;
  }>;
  kycDetails: {
    fullName?: string;
    phone?: string;
    address?: string;
    businessName?: string;
    taxId?: string;
  };
  adminNotes?: string;
  reviewedBy?: {
    _id: string;
    name: string;
    email: string;
  };
  reviewedAt?: string;
  initialTrustScore?: number;
  createdAt: string;
}

interface VerificationResponse {
  success: boolean;
  data: VerificationRequest[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  summary: {
    pending: number;
    under_review: number;
    approved: number;
    rejected: number;
    total: number;
  };
}

const AdminVerificationDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    pending: 0,
    under_review: 0,
    approved: 0,
    rejected: 0,
    total: 0
  });
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<VerificationRequest | null>(null);
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  
  // Approval form state
  const [trustScore, setTrustScore] = useState(70);
  const [verificationBadge, setVerificationBadge] = useState<'bronze' | 'silver' | 'gold' | 'platinum'>('silver');
  const [enableRouting, setEnableRouting] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  
  // Rejection form state
  const [rejectionReason, setRejectionReason] = useState('');
  
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchVerificationRequests();
    }
  }, [user, statusFilter, currentPage]);

  const fetchVerificationRequests = async () => {
    try {
      setLoading(true);
      const response = await api.get('/admin/verification-requests', {
        params: {
          status: statusFilter === 'all' ? undefined : statusFilter,
          page: currentPage,
          limit: 10
        }
      });

      const data = response.data as VerificationResponse;
      if (data.success) {
        setRequests(data.data);
        setSummary(data.summary);
        setTotalPages(data.pagination.totalPages);
      }
    } catch (error: any) {
      console.error('Error fetching verification requests:', error);
      setMessage({ type: 'error', text: 'Failed to load verification requests' });
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selectedRequest) return;

    try {
      setActionLoading(true);
      const response = await api.post(`/admin/verification-requests/${selectedRequest._id}/approve`, {
        trustScore,
        verificationBadge,
        enableRouting,
        adminNotes
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Organizer approved successfully!' });
        setShowApprovalModal(false);
        setSelectedRequest(null);
        fetchVerificationRequests();
        resetApprovalForm();
      }
    } catch (error: any) {
      console.error('Error approving organizer:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to approve organizer' 
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selectedRequest || !rejectionReason.trim()) {
      setMessage({ type: 'error', text: 'Please provide a rejection reason' });
      return;
    }

    try {
      setActionLoading(true);
      const response = await api.post(`/admin/verification-requests/${selectedRequest._id}/reject`, {
        rejectionReason,
        adminNotes
      });

      if (response.data.success) {
        setMessage({ type: 'success', text: 'Organizer rejected' });
        setShowRejectionModal(false);
        setSelectedRequest(null);
        fetchVerificationRequests();
        resetRejectionForm();
      }
    } catch (error: any) {
      console.error('Error rejecting organizer:', error);
      setMessage({ 
        type: 'error', 
        text: error.response?.data?.error || 'Failed to reject organizer' 
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecalculateScore = async (requestId: string) => {
    try {
      const response = await api.post(`/admin/verification-requests/${requestId}/recalculate-score`);
      
      if (response.data.success) {
        const { trustScore: newScore, verificationBadge: newBadge } = response.data.data;
        setMessage({ 
          type: 'success', 
          text: `Trust score recalculated: ${newScore.overall}/100 (${newBadge})` 
        });
        fetchVerificationRequests();
      }
    } catch (error: any) {
      console.error('Error recalculating score:', error);
      setMessage({ type: 'error', text: 'Failed to recalculate trust score' });
    }
  };

  const resetApprovalForm = () => {
    setTrustScore(70);
    setVerificationBadge('silver');
    setEnableRouting(false);
    setAdminNotes('');
  };

  const resetRejectionForm = () => {
    setRejectionReason('');
    setAdminNotes('');
  };

  const openApprovalModal = (request: VerificationRequest) => {
    setSelectedRequest(request);
    setTrustScore(request.organizerId.organizerProfile?.trustScore?.overall || 70);
    setShowApprovalModal(true);
  };

  const openRejectionModal = (request: VerificationRequest) => {
    setSelectedRequest(request);
    setShowRejectionModal(true);
  };

  const getBadgeForScore = (score: number): 'bronze' | 'silver' | 'gold' | 'platinum' => {
    if (score >= 95) return 'platinum';
    if (score >= 85) return 'gold';
    if (score >= 70) return 'silver';
    return 'bronze';
  };

  useEffect(() => {
    setVerificationBadge(getBadgeForScore(trustScore));
  }, [trustScore]);

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!user || user.role !== 'admin') {
    return <Navigate to="/login" />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Organizer Verification</h1>
              <p className="mt-1 text-sm text-gray-600">Review and approve organizer accounts</p>
            </div>
            <button
              onClick={() => navigate('/admin/dashboard')}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              ← Back to Dashboard
            </button>
          </div>

          {/* Summary Cards */}
          <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-md bg-yellow-500 text-white">
                      <span className="text-2xl">⏳</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Pending</dt>
                      <dd className="text-2xl font-semibold text-gray-900">{summary.pending}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-md bg-blue-500 text-white">
                      <span className="text-2xl">👀</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Under Review</dt>
                      <dd className="text-2xl font-semibold text-gray-900">{summary.under_review}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-md bg-green-500 text-white">
                      <span className="text-2xl">✅</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Approved</dt>
                      <dd className="text-2xl font-semibold text-gray-900">{summary.approved}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-md bg-red-500 text-white">
                      <span className="text-2xl">❌</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Rejected</dt>
                      <dd className="text-2xl font-semibold text-gray-900">{summary.rejected}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="flex items-center justify-center h-12 w-12 rounded-md bg-gray-700 text-white">
                      <span className="text-2xl">📊</span>
                    </div>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">Total</dt>
                      <dd className="text-2xl font-semibold text-gray-900">{summary.total}</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Message Alert */}
      {message && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className={`p-4 rounded-md ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            <p>{message.text}</p>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="bg-white shadow rounded-lg p-4">
          <div className="flex gap-2">
            <button
              onClick={() => { setStatusFilter('all'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-md ${
                statusFilter === 'all' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => { setStatusFilter('pending'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-md ${
                statusFilter === 'pending' 
                  ? 'bg-yellow-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => { setStatusFilter('under_review'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-md ${
                statusFilter === 'under_review' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Under Review
            </button>
            <button
              onClick={() => { setStatusFilter('approved'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-md ${
                statusFilter === 'approved' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Approved
            </button>
            <button
              onClick={() => { setStatusFilter('rejected'); setCurrentPage(1); }}
              className={`px-4 py-2 rounded-md ${
                statusFilter === 'rejected' 
                  ? 'bg-red-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Rejected
            </button>
          </div>
        </div>
      </div>

      {/* Verification Requests Table */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 pb-12">
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading verification requests...</p>
            </div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500">No verification requests found</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organizer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Experience
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Request Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Submitted
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {requests.map((request) => (
                  <tr key={request._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{request.organizerName}</div>
                          <div className="text-sm text-gray-500">{request.organizerEmail}</div>
                          {request.organizerId.phone && (
                            <div className="text-sm text-gray-500">{request.organizerId.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900">
                        {request.organizerId.organizerProfile?.yearsOfExperience || 0} years
                      </div>
                      {request.organizerId.organizerProfile?.specialties && request.organizerId.organizerProfile.specialties.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          {request.organizerId.organizerProfile.specialties.slice(0, 2).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        {request.requestType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        request.status === 'approved' ? 'bg-green-100 text-green-800' :
                        request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        request.status === 'under_review' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {request.status}
                      </span>
                      {request.priority === 'high' && (
                        <span className="ml-2 px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                          High Priority
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(request.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        {request.status === 'pending' || request.status === 'under_review' ? (
                          <>
                            <button
                              onClick={() => openApprovalModal(request)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => openRejectionModal(request)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-gray-400">
                            {request.status === 'approved' ? 'Approved' : 'Rejected'}
                          </span>
                        )}
                        <button
                          onClick={() => handleRecalculateScore(request._id)}
                          className="text-blue-600 hover:text-blue-900"
                          title="Recalculate trust score"
                        >
                          📊
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Page <span className="font-medium">{currentPage}</span> of{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === page
                            ? 'z-10 bg-blue-600 border-blue-600 text-white'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Approval Modal */}
      {showApprovalModal && selectedRequest && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Approve Organizer
                </h3>
                <div className="text-sm text-gray-600 mb-4">
                  <p><strong>Name:</strong> {selectedRequest.organizerName}</p>
                  <p><strong>Email:</strong> {selectedRequest.organizerEmail}</p>
                  <p><strong>Experience:</strong> {selectedRequest.organizerId.organizerProfile?.yearsOfExperience || 0} years</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Trust Score (0-100)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={trustScore}
                      onChange={(e) => setTrustScore(Number(e.target.value))}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Current badge: <span className="font-semibold">{verificationBadge.toUpperCase()}</span>
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Verification Badge
                    </label>
                    <select
                      value={verificationBadge}
                      onChange={(e) => setVerificationBadge(e.target.value as any)}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="bronze">Bronze (50-69)</option>
                      <option value="silver">Silver (70-84)</option>
                      <option value="gold">Gold (85-94)</option>
                      <option value="platinum">Platinum (95-100)</option>
                    </select>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={enableRouting}
                      onChange={(e) => setEnableRouting(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Enable Payment Routing (Direct Payments)
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Admin Notes (Optional)
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={3}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Add any notes for the organizer..."
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Approving...' : 'Approve Organizer'}
                </button>
                <button
                  onClick={() => { setShowApprovalModal(false); resetApprovalForm(); }}
                  disabled={actionLoading}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectionModal && selectedRequest && (
        <div className="fixed z-10 inset-0 overflow-y-auto">
          <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">
                  Reject Organizer Verification
                </h3>
                <div className="text-sm text-gray-600 mb-4">
                  <p><strong>Name:</strong> {selectedRequest.organizerName}</p>
                  <p><strong>Email:</strong> {selectedRequest.organizerEmail}</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Rejection Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      rows={4}
                      required
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500"
                      placeholder="Please provide a detailed reason for rejection..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Additional Notes (Optional)
                    </label>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      rows={2}
                      className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Internal admin notes..."
                    />
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  onClick={handleReject}
                  disabled={actionLoading || !rejectionReason.trim()}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                >
                  {actionLoading ? 'Rejecting...' : 'Reject Organizer'}
                </button>
                <button
                  onClick={() => { setShowRejectionModal(false); resetRejectionForm(); }}
                  disabled={actionLoading}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:mt-0 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminVerificationDashboard;
