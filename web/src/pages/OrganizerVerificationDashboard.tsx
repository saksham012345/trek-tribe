import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import '../styles/OrganizerVerification.css';

interface OrganizerVerification {
  _id: string;
  name: string;
  email: string;
  organizerProfile?: {
    bio: string;
    experience: string;
    specialties: string[];
    yearsOfExperience: number;
  };
  organizerVerificationSubmittedAt: string;
  organizerVerificationStatus: 'pending' | 'approved' | 'rejected';
}

export const OrganizerVerificationDashboard: React.FC = () => {
  const { token, user } = useAuth();
  const [verifications, setVerifications] = useState<OrganizerVerification[]>([]);
  const [selectedVerification, setSelectedVerification] = useState<OrganizerVerification | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [filter, setFilter] = useState<'pending' | 'approved' | 'rejected' | 'all'>('pending');

  useEffect(() => {
    if (user?.role !== 'admin') {
      setError('Access denied. Admin only.');
      return;
    }
    fetchVerifications();
  }, [token, user, filter]);

  const fetchVerifications = async () => {
    try {
      setLoading(true);
      const endpoint = filter === 'all'
        ? '/api/admin/organizer-verifications/all'
        : '/api/admin/organizer-verifications/all?status=' + filter;

      const response = await axios.get(endpoint, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setVerifications(response.data.verifications || []);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to fetch verifications');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (userId: string) => {
    try {
      await axios.post(
        `/api/admin/organizer-verifications/${userId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccessMessage('Organizer approved successfully! Email notification sent.');
      setSelectedVerification(null);
      fetchVerifications();

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve organizer');
    }
  };

  const handleReject = async (userId: string) => {
    if (!rejectionReason.trim()) {
      setError('Please provide a rejection reason');
      return;
    }

    try {
      await axios.post(
        `/api/admin/organizer-verifications/${userId}/reject`,
        { reason: rejectionReason },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setSuccessMessage('Organizer rejected. Email notification sent with reason.');
      setSelectedVerification(null);
      setRejectionReason('');
      fetchVerifications();

      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reject organizer');
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: string } = {
      pending: '⏳ Pending',
      approved: '✅ Approved',
      rejected: '❌ Rejected'
    };
    return badges[status] || status;
  };

  return (
    <div className="verification-dashboard">
      <div className="verification-header">
        <h1>🔐 Organizer Verification Dashboard</h1>
        <p>Approve or reject organizer applications</p>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(status => (
          <button
            key={status}
            className={`filter-tab ${filter === status ? 'active' : ''}`}
            onClick={() => setFilter(status)}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {/* Messages */}
      {error && <div className="alert alert-error">{error}</div>}
      {successMessage && <div className="alert alert-success">{successMessage}</div>}

      {/* Main Content */}
      <div className="verification-content">
        {/* Verification List */}
        <div className="verification-list">
          {loading ? (
            <div className="loading">Loading verifications...</div>
          ) : verifications.length === 0 ? (
            <div className="empty-state">
              <p>No {filter === 'all' ? 'verifications' : filter + ' verifications'} found</p>
            </div>
          ) : (
            <div className="cards-grid">
              {verifications.map(verification => (
                <div
                  key={verification._id}
                  className={`verification-card ${verification.organizerVerificationStatus}`}
                  onClick={() => setSelectedVerification(verification)}
                >
                  <div className="card-header">
                    <div className="card-title">
                      <h3>{verification.name}</h3>
                      <span className="status-badge">
                        {getStatusBadge(verification.organizerVerificationStatus)}
                      </span>
                    </div>
                  </div>

                  <div className="card-body">
                    <p><strong>Email:</strong> {verification.email}</p>
                    <p><strong>Experience:</strong> {verification.organizerProfile?.yearsOfExperience || 0} years</p>
                    <p><strong>Bio:</strong> {verification.organizerProfile?.bio?.substring(0, 50) || 'N/A'}...</p>
                    <p className="submitted-date">
                      Submitted: {new Date(verification.organizerVerificationSubmittedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="card-action">
                    {verification.organizerVerificationStatus === 'pending' && (
                      <span className="action-hint">Click to review</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedVerification && (
          <div className="verification-detail">
            <div className="detail-header">
              <h2>{selectedVerification.name}</h2>
              <button
                className="close-btn"
                onClick={() => {
                  setSelectedVerification(null);
                  setRejectionReason('');
                }}
              >
                ✕
              </button>
            </div>

            <div className="detail-body">
              <div className="detail-section">
                <h3>Personal Information</h3>
                <div className="detail-row">
                  <label>Name:</label>
                  <p>{selectedVerification.name}</p>
                </div>
                <div className="detail-row">
                  <label>Email:</label>
                  <p>{selectedVerification.email}</p>
                </div>
              </div>

              <div className="detail-section">
                <h3>Organizer Profile</h3>
                <div className="detail-row">
                  <label>Bio:</label>
                  <p>{selectedVerification.organizerProfile?.bio || 'N/A'}</p>
                </div>
                <div className="detail-row">
                  <label>Experience:</label>
                  <p>{selectedVerification.organizerProfile?.experience || 'N/A'}</p>
                </div>
                <div className="detail-row">
                  <label>Years of Experience:</label>
                  <p>{selectedVerification.organizerProfile?.yearsOfExperience || 0} years</p>
                </div>
                <div className="detail-row">
                  <label>Specialties:</label>
                  <div className="specialties">
                    {selectedVerification.organizerProfile?.specialties?.map((spec, idx) => (
                      <span key={idx} className="specialty-tag">{spec}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Application Timeline</h3>
                <div className="detail-row">
                  <label>Submitted:</label>
                  <p>{new Date(selectedVerification.organizerVerificationSubmittedAt).toLocaleString()}</p>
                </div>
                <div className="detail-row">
                  <label>Status:</label>
                  <p className={`status-text ${selectedVerification.organizerVerificationStatus}`}>
                    {getStatusBadge(selectedVerification.organizerVerificationStatus)}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              {selectedVerification.organizerVerificationStatus === 'pending' && (
                <div className="detail-actions">
                  <div className="rejection-section">
                    <label htmlFor="rejection-reason">Rejection Reason (if rejecting):</label>
                    <textarea
                      id="rejection-reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="e.g., Incomplete profile, Missing certifications, Suspicious activity..."
                      rows={3}
                    />
                  </div>

                  <div className="button-group">
                    <button
                      className="btn btn-approve"
                      onClick={() => handleApprove(selectedVerification._id)}
                    >
                      ✅ Approve Organizer
                    </button>
                    <button
                      className="btn btn-reject"
                      onClick={() => handleReject(selectedVerification._id)}
                      disabled={!rejectionReason.trim()}
                    >
                      ❌ Reject Application
                    </button>
                  </div>
                </div>
              )}

              {selectedVerification.organizerVerificationStatus === 'approved' && (
                <div className="detail-actions approved">
                  <div className="success-message">
                    ✅ This organizer has been approved and can now create trips.
                  </div>
                </div>
              )}

              {selectedVerification.organizerVerificationStatus === 'rejected' && (
                <div className="detail-actions rejected">
                  <div className="error-message">
                    ❌ This organizer's application was rejected.
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OrganizerVerificationDashboard;
