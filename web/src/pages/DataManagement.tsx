import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

interface DataRequest {
  type: 'export' | 'delete' | 'portability';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  requestedAt: string;
  completedAt?: string;
  downloadUrl?: string;
}

const DataManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'export' | 'delete' | 'requests'>('overview');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  };

  const handleDataExport = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/user/data-export', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data.success) {
        showMessage('success', 'Data export request submitted. You will receive an email when your data is ready for download.');
        // Refresh requests list
        fetchDataRequests();
      }
    } catch (error: any) {
      showMessage('error', 'Failed to request data export. Please try again later.');
      console.error('Data export error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDataDeletion = async () => {
    if (deleteConfirmation !== 'DELETE MY ACCOUNT') {
      showMessage('error', 'Please type "DELETE MY ACCOUNT" to confirm account deletion.');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/user/data-delete', {
        confirmation: deleteConfirmation
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data.success) {
        showMessage('success', 'Account deletion request submitted. You will receive a confirmation email.');
        setDeleteConfirmation('');
      }
    } catch (error: any) {
      showMessage('error', 'Failed to request account deletion. Please contact support.');
      console.error('Data deletion error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDataPortability = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/api/user/data-portability', {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data.success) {
        showMessage('success', 'Data portability request submitted. You will receive a machine-readable copy of your data.');
        fetchDataRequests();
      }
    } catch (error: any) {
      showMessage('error', 'Failed to request data portability. Please try again later.');
      console.error('Data portability error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDataRequests = async () => {
    try {
      const response = await axios.get('/api/user/data-requests', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      });
      
      if (response.data.success) {
        setDataRequests(response.data.requests);
      }
    } catch (error) {
      console.error('Failed to fetch data requests:', error);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'requests') {
      fetchDataRequests();
    }
  }, [activeTab]);

  const TabButton: React.FC<{ id: string; active: boolean; onClick: () => void; children: React.ReactNode }> = ({ id, active, onClick, children }) => (
    <button
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
        active
          ? 'bg-nature-600 text-white'
          : 'bg-gray-100 text-forest-700 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );

  return (
    <div className="min-h-screen bg-forest-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-8">
          <div className="bg-gradient-to-r from-forest-600 to-nature-600 px-8 py-12 text-white">
            <h1 className="text-4xl font-bold mb-4">🔐 Data Management</h1>
            <p className="text-xl text-forest-100">
              Manage your personal data and exercise your privacy rights
            </p>
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success' 
              ? 'bg-green-100 border border-green-300 text-green-800'
              : 'bg-red-100 border border-red-300 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex flex-wrap gap-2 mb-6">
            <TabButton
              id="overview"
              active={activeTab === 'overview'}
              onClick={() => setActiveTab('overview')}
            >
              📋 Overview
            </TabButton>
            <TabButton
              id="export"
              active={activeTab === 'export'}
              onClick={() => setActiveTab('export')}
            >
              📤 Export Data
            </TabButton>
            <TabButton
              id="delete"
              active={activeTab === 'delete'}
              onClick={() => setActiveTab('delete')}
            >
              🗑️ Delete Account
            </TabButton>
            <TabButton
              id="requests"
              active={activeTab === 'requests'}
              onClick={() => setActiveTab('requests')}
            >
              📋 My Requests
            </TabButton>
          </div>

          {/* Tab Content */}
          <div className="min-h-[400px]">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-2xl font-bold text-forest-800 mb-4">Your Data Rights</h2>
                  <p className="text-forest-600 mb-6">
                    Under GDPR and other privacy laws, you have the following rights regarding your personal data:
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-blue-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-forest-800 mb-3">🔍 Right to Access</h3>
                    <p className="text-forest-600 mb-4">
                      You have the right to request a copy of all personal data we hold about you.
                    </p>
                    <button
                      onClick={() => setActiveTab('export')}
                      className="text-nature-600 hover:text-nature-700 font-medium"
                    >
                      Request Data Export →
                    </button>
                  </div>

                  <div className="bg-green-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-forest-800 mb-3">📱 Right to Portability</h3>
                    <p className="text-forest-600 mb-4">
                      You can request your data in a machine-readable format to transfer to another service.
                    </p>
                    <button
                      onClick={() => setActiveTab('export')}
                      className="text-nature-600 hover:text-nature-700 font-medium"
                    >
                      Request Portable Data →
                    </button>
                  </div>

                  <div className="bg-yellow-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-forest-800 mb-3">✏️ Right to Rectification</h3>
                    <p className="text-forest-600 mb-4">
                      You can update your personal information at any time through your profile settings.
                    </p>
                    <Link
                      to="/profile"
                      className="text-nature-600 hover:text-nature-700 font-medium"
                    >
                      Update Profile →
                    </Link>
                  </div>

                  <div className="bg-red-50 p-6 rounded-lg">
                    <h3 className="text-lg font-semibold text-forest-800 mb-3">🗑️ Right to Erasure</h3>
                    <p className="text-forest-600 mb-4">
                      You can request the deletion of your account and all associated personal data.
                    </p>
                    <button
                      onClick={() => setActiveTab('delete')}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      Delete Account →
                    </button>
                  </div>
                </div>

                <div className="bg-forest-50 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-forest-800 mb-3">📞 Need Help?</h3>
                  <p className="text-forest-600 mb-4">
                    If you have questions about your data or need assistance with any of these rights, please contact our Data Protection Officer.
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <a
                      href="mailto:privacy@trektribe.com"
                      className="text-nature-600 hover:text-nature-700 font-medium"
                    >
                      📧 privacy@trektribe.com
                    </a>
                    <Link
                      to="/privacy"
                      className="text-nature-600 hover:text-nature-700 font-medium"
                    >
                      📋 Privacy Policy →
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* Export Data Tab */}
            {activeTab === 'export' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-forest-800 mb-4">Export Your Data</h2>
                  <p className="text-forest-600 mb-6">
                    Request a complete copy of your personal data. This includes your profile information, 
                    trip history, messages, and any other data associated with your account.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white border-2 border-nature-200 rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-forest-800 mb-4">📤 Standard Export</h3>
                    <ul className="space-y-2 text-forest-600 mb-6">
                      <li>• Profile information and settings</li>
                      <li>• Trip bookings and history</li>
                      <li>• Messages and communications</li>
                      <li>• Preferences and consent records</li>
                    </ul>
                    <button
                      onClick={handleDataExport}
                      disabled={loading}
                      className="w-full bg-nature-600 hover:bg-nature-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                    >
                      {loading ? 'Processing...' : 'Request Data Export'}
                    </button>
                  </div>

                  <div className="bg-white border-2 border-earth-200 rounded-lg p-6">
                    <h3 className="text-xl font-semibold text-forest-800 mb-4">📱 Portable Format</h3>
                    <ul className="space-y-2 text-forest-600 mb-6">
                      <li>• Machine-readable JSON format</li>
                      <li>• Structured for easy import</li>
                      <li>• Includes data relationships</li>
                      <li>• API-compatible format</li>
                    </ul>
                    <button
                      onClick={handleDataPortability}
                      disabled={loading}
                      className="w-full bg-earth-600 hover:bg-earth-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                    >
                      {loading ? 'Processing...' : 'Request Portable Data'}
                    </button>
                  </div>
                </div>

                <div className="bg-blue-50 p-6 rounded-lg">
                  <h4 className="font-semibold text-forest-800 mb-2">📋 What happens next?</h4>
                  <ul className="space-y-2 text-forest-600">
                    <li>• We'll process your request within 30 days</li>
                    <li>• You'll receive an email notification when ready</li>
                    <li>• Download links are valid for 7 days</li>
                    <li>• All exports are encrypted and secure</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Delete Account Tab */}
            {activeTab === 'delete' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-red-700 mb-4">⚠️ Delete Your Account</h2>
                  <p className="text-forest-600 mb-6">
                    This action will permanently delete your account and all associated data. 
                    This cannot be undone.
                  </p>
                </div>

                <div className="bg-red-50 border border-red-200 p-6 rounded-lg">
                  <h3 className="text-lg font-semibold text-red-800 mb-4">What will be deleted:</h3>
                  <ul className="space-y-2 text-red-700 mb-6">
                    <li>• Your profile and account information</li>
                    <li>• All trip bookings and history</li>
                    <li>• Messages and communications</li>
                    <li>• Photos and uploaded content</li>
                    <li>• Preferences and settings</li>
                    <li>• Any associated payment information</li>
                  </ul>

                  <div className="bg-yellow-100 border border-yellow-300 p-4 rounded-lg mb-6">
                    <h4 className="font-semibold text-yellow-800 mb-2">📝 Before you delete:</h4>
                    <ul className="space-y-1 text-yellow-700">
                      <li>• Consider exporting your data first</li>
                      <li>• Cancel any active trip bookings</li>
                      <li>• This action cannot be reversed</li>
                    </ul>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-red-800 font-medium mb-2">
                        Type "DELETE MY ACCOUNT" to confirm:
                      </label>
                      <input
                        type="text"
                        value={deleteConfirmation}
                        onChange={(e) => setDeleteConfirmation(e.target.value)}
                        className="w-full p-3 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                        placeholder="DELETE MY ACCOUNT"
                      />
                    </div>

                    <button
                      onClick={handleDataDeletion}
                      disabled={loading || deleteConfirmation !== 'DELETE MY ACCOUNT'}
                      className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white py-3 px-6 rounded-lg font-semibold transition-colors"
                    >
                      {loading ? 'Processing...' : 'Permanently Delete Account'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Requests Tab */}
            {activeTab === 'requests' && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-forest-800 mb-4">Your Data Requests</h2>
                  <p className="text-forest-600 mb-6">
                    Track the status of your data requests and download completed exports.
                  </p>
                </div>

                {dataRequests.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📋</div>
                    <h3 className="text-xl font-semibold text-forest-800 mb-2">No requests yet</h3>
                    <p className="text-forest-600">
                      You haven't made any data requests. Use the other tabs to export or delete your data.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dataRequests.map((request, index) => (
                      <div key={index} className="bg-white border border-gray-200 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold text-forest-800 capitalize">
                              {request.type} Request
                            </h3>
                            <p className="text-forest-500">
                              Requested: {new Date(request.requestedAt).toLocaleDateString()}
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                            request.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : request.status === 'processing'
                              ? 'bg-blue-100 text-blue-800'
                              : request.status === 'failed'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </div>

                        {request.status === 'completed' && request.downloadUrl && (
                          <div className="bg-green-50 p-4 rounded-lg">
                            <p className="text-green-800 mb-3">
                              ✅ Your data is ready for download!
                            </p>
                            <a
                              href={request.downloadUrl}
                              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                            >
                              📥 Download Data
                            </a>
                          </div>
                        )}

                        {request.status === 'processing' && (
                          <div className="bg-blue-50 p-4 rounded-lg">
                            <p className="text-blue-800">
                              🔄 We're processing your request. You'll receive an email when it's ready.
                            </p>
                          </div>
                        )}

                        {request.status === 'failed' && (
                          <div className="bg-red-50 p-4 rounded-lg">
                            <p className="text-red-800">
                              ❌ There was an error processing your request. Please contact support.
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Back Navigation */}
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-forest-600 hover:text-forest-800 font-medium transition-colors"
          >
            ← Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
};

export default DataManagement;