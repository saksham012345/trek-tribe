import React, { useEffect, useState } from 'react';
import api from '../config/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Tooltip } from '../components/ui/Tooltip';
import { Skeleton } from '../components/ui/Skeleton';

interface StatusResponse {
  onboarded: boolean;
  accountId?: string;
  status?: string;
  commissionRate?: number;
  kycStatus?: string;
}

interface KYCStatus {
  status: 'pending' | 'submitted' | 'under_review' | 'approved' | 'rejected';
  message?: string;
}

const OrganizerRouteOnboarding: React.FC = () => {
  const { user } = useAuth();
  const { add } = useToast();
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [kycStatus, setKycStatus] = useState<KYCStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittingKYC, setSubmittingKYC] = useState(false);
  const [activeStep, setActiveStep] = useState<'onboard' | 'kyc'>('onboard');
  const [form, setForm] = useState({
    legalBusinessName: '',
    businessType: 'proprietorship',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    bankName: '',
  });
  const [kycDocuments, setKycDocuments] = useState({
    business_proof: null as File | null,
    business_pan: null as File | null,
    promoter_address: null as File | null,
    business_operation_proof: null as File | null,
  });

  useEffect(() => {
    fetchStatus();
    fetchKYCStatus();
  }, []);

  async function fetchStatus() {
    try {
      const { data } = await api.get('/api/marketplace/organizer/status');
      setStatus(data);
      // If onboarded, show KYC step
      if (data.onboarded && data.kycStatus !== 'approved') {
        setActiveStep('kyc');
      }
    } catch (error) {
      console.error('Failed to fetch onboarding status', error);
      add('Failed to fetch onboarding status', 'error');
    }
  }

  async function fetchKYCStatus() {
    try {
      const { data } = await api.get('/api/verification/razorpay/kyc-status');
      setKycStatus(data);
    } catch (error) {
      // KYC status endpoint might not be available if account not created yet
      console.log('KYC status not available yet');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await api.post('/api/marketplace/organizer/onboard', {
        legalBusinessName: form.legalBusinessName,
        businessType: form.businessType,
        bankAccount: {
          accountNumber: form.accountNumber,
          ifscCode: form.ifscCode,
          accountHolderName: form.accountHolderName,
          bankName: form.bankName,
        },
      });
      
      await fetchStatus();
      await fetchKYCStatus();
      
      // If account created, move to KYC step
      if (response.data.success && response.data.accountId) {
        setActiveStep('kyc');
        add('Account created! Please submit KYC documents to activate payouts.', 'success');
      } else {
        add('Onboarding submitted. You can receive payouts after activation.', 'success');
      }
    } catch (error: any) {
      add(error.response?.data?.error || error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleKYCSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    // Check if at least one document is uploaded
    const hasDocuments = Object.values(kycDocuments).some(doc => doc !== null);
    if (!hasDocuments) {
      add('Please upload at least one KYC document', 'error');
      return;
    }

    setSubmittingKYC(true);
    try {
      const formData = new FormData();
      
      if (kycDocuments.business_proof) {
        formData.append('business_proof', kycDocuments.business_proof);
      }
      if (kycDocuments.business_pan) {
        formData.append('business_pan', kycDocuments.business_pan);
      }
      if (kycDocuments.promoter_address) {
        formData.append('promoter_address', kycDocuments.promoter_address);
      }
      if (kycDocuments.business_operation_proof) {
        formData.append('business_operation_proof', kycDocuments.business_operation_proof);
      }

      const response = await api.post('/api/verification/razorpay/submit-kyc', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        add('KYC documents submitted successfully! Razorpay will review and verify your account.', 'success');
        await fetchKYCStatus();
        await fetchStatus();
      } else {
        throw new Error(response.data.error || 'Failed to submit KYC documents');
      }
    } catch (error: any) {
      add(error.response?.data?.error || error.message || 'Failed to submit KYC documents', 'error');
    } finally {
      setSubmittingKYC(false);
    }
  }

  const handleFileChange = (field: keyof typeof kycDocuments, file: File | null) => {
    setKycDocuments(prev => ({ ...prev, [field]: file }));
  };

  if (!user) return <div className="p-8">Login required.</div>;

  return (
    <div className="max-w-3xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Route Onboarding</h1>
      <p className="text-gray-600 mb-6">Connect your bank to receive automatic payouts after bookings.</p>

      {/* Status Display */}
      {!status ? (
        <div className="mb-6">
          <div className="p-4 rounded-lg border bg-white">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-4 w-48" />
            <Skeleton className="mt-2 h-4 w-64" />
          </div>
        </div>
      ) : status.onboarded ? (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="font-semibold text-green-800">✅ Razorpay Account Created</p>
          <p className="text-sm mt-1">Account ID: {status.accountId}</p>
          <p className="text-sm">Status: {status.status}</p>
          <p className="text-sm">Commission: {status.commissionRate || 5}%</p>
          <p className={`text-sm font-semibold mt-2 ${
            status.kycStatus === 'approved' ? 'text-green-700' :
            status.kycStatus === 'rejected' ? 'text-red-700' :
            status.kycStatus === 'under_review' ? 'text-yellow-700' :
            'text-orange-700'
          }`}>
            KYC Status: {status.kycStatus || 'pending'}
          </p>
          {status.kycStatus === 'approved' && (
            <p className="text-sm text-green-700 mt-2">✅ Your account is activated and ready to receive payouts!</p>
          )}
          {status.kycStatus === 'under_review' && (
            <p className="text-sm text-yellow-700 mt-2">⏳ KYC documents are under review by Razorpay. This usually takes 1-3 business days.</p>
          )}
          {status.kycStatus === 'rejected' && (
            <p className="text-sm text-red-700 mt-2">❌ KYC verification was rejected. Please check your email for details and resubmit.</p>
          )}
        </div>
      ) : null}

      {/* Step Navigation */}
      {status?.onboarded && (
        <div className="mb-6 flex gap-2 border-b">
          <button
            onClick={() => setActiveStep('onboard')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeStep === 'onboard'
                ? 'border-b-2 border-emerald-600 text-emerald-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Account Details
          </button>
          <button
            onClick={() => setActiveStep('kyc')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeStep === 'kyc'
                ? 'border-b-2 border-emerald-600 text-emerald-700'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            KYC Documents {status.kycStatus === 'approved' && '✅'}
          </button>
        </div>
      )}

      {/* Onboarding Form */}
      {activeStep === 'onboard' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-900">
              <span className="font-semibold">📋 About Razorpay Route & KYC:</span> Razorpay handles KYC verification for all Route accounts. After creating your account, you'll need to submit business documents for verification. This is required by Razorpay to enable payouts.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Legal Business Name</label>
            <input
              required
              className="w-full rounded border px-3 py-2"
              value={form.legalBusinessName}
              onChange={(e) => setForm({ ...form, legalBusinessName: e.target.value })}
              placeholder="Your registered business name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Business Type</label>
            <select
              className="w-full rounded border px-3 py-2"
              value={form.businessType}
              onChange={(e) => setForm({ ...form, businessType: e.target.value })}
            >
              <option value="proprietorship">Proprietorship</option>
              <option value="partnership">Partnership</option>
              <option value="llp">LLP</option>
              <option value="pvt_ltd">Private Limited</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Account Number</label>
              <input
                required
                className="w-full rounded border px-3 py-2"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="Bank account number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1 flex items-center gap-2">
                IFSC Code
                <Tooltip text="We only store hashed identifiers and never your full bank details." />
              </label>
              <input
                required
                className="w-full rounded border px-3 py-2"
                value={form.ifscCode}
                onChange={(e) => setForm({ ...form, ifscCode: e.target.value.toUpperCase() })}
                placeholder="HDFC0001234"
                maxLength={11}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Account Holder Name</label>
              <input
                required
                className="w-full rounded border px-3 py-2"
                value={form.accountHolderName}
                onChange={(e) => setForm({ ...form, accountHolderName: e.target.value })}
                placeholder="Name as per bank account"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Bank Name (optional)</label>
              <input
                className="w-full rounded border px-3 py-2"
                value={form.bankName}
                onChange={(e) => setForm({ ...form, bankName: e.target.value })}
                placeholder="e.g., HDFC Bank"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || status?.onboarded}
            className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-md hover:bg-emerald-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
          >
            {loading ? 'Creating Account...' : status?.onboarded ? 'Account Created ✅' : 'Create Razorpay Account'}
          </button>
        </form>
      )}

      {/* KYC Document Submission */}
      {activeStep === 'kyc' && status?.onboarded && (
        <div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-amber-900">
              <span className="font-semibold">🔐 KYC Verification Required:</span> Razorpay requires KYC documents to verify your business and enable payouts. Please upload the required documents below. Verification typically takes 1-3 business days.
            </p>
          </div>

          {status.kycStatus === 'approved' ? (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
              <div className="text-4xl mb-2">✅</div>
              <h3 className="text-xl font-bold text-green-800 mb-2">KYC Verified!</h3>
              <p className="text-green-700">Your Razorpay account is fully activated and ready to receive payouts.</p>
            </div>
          ) : (
            <form onSubmit={handleKYCSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-emerald-400 transition-colors">
                  <label className="block text-sm font-medium mb-2">
                    Business Proof <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">GST certificate, business license, or registration certificate</p>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => handleFileChange('business_proof', e.target.files?.[0] || null)}
                    className="w-full text-sm"
                  />
                  {kycDocuments.business_proof && (
                    <p className="text-xs text-green-600 mt-1">✓ {kycDocuments.business_proof.name}</p>
                  )}
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-emerald-400 transition-colors">
                  <label className="block text-sm font-medium mb-2">
                    Business PAN <span className="text-red-500">*</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2">PAN card of the business entity</p>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => handleFileChange('business_pan', e.target.files?.[0] || null)}
                    className="w-full text-sm"
                  />
                  {kycDocuments.business_pan && (
                    <p className="text-xs text-green-600 mt-1">✓ {kycDocuments.business_pan.name}</p>
                  )}
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-emerald-400 transition-colors">
                  <label className="block text-sm font-medium mb-2">
                    Promoter Address Proof
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Aadhaar, passport, or utility bill</p>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => handleFileChange('promoter_address', e.target.files?.[0] || null)}
                    className="w-full text-sm"
                  />
                  {kycDocuments.promoter_address && (
                    <p className="text-xs text-green-600 mt-1">✓ {kycDocuments.promoter_address.name}</p>
                  )}
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-emerald-400 transition-colors">
                  <label className="block text-sm font-medium mb-2">
                    Business Operation Proof
                  </label>
                  <p className="text-xs text-gray-500 mb-2">Bank statement, invoices, or operation certificate</p>
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    onChange={(e) => handleFileChange('business_operation_proof', e.target.files?.[0] || null)}
                    className="w-full text-sm"
                  />
                  {kycDocuments.business_operation_proof && (
                    <p className="text-xs text-green-600 mt-1">✓ {kycDocuments.business_operation_proof.name}</p>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs text-gray-600">
                  <span className="font-semibold">Note:</span> All documents are securely uploaded and sent to Razorpay for verification. 
                  Accepted formats: JPG, PNG, PDF (max 10MB per file). 
                  Razorpay will review your documents and notify you via email once verification is complete.
                </p>
              </div>

              <button
                type="submit"
                disabled={submittingKYC || status.kycStatus === 'approved' || status.kycStatus === 'under_review'}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white shadow-md hover:bg-emerald-700 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {submittingKYC 
                  ? 'Submitting Documents...' 
                  : status.kycStatus === 'under_review'
                  ? 'Documents Under Review ⏳'
                  : status.kycStatus === 'approved'
                  ? 'KYC Verified ✅'
                  : 'Submit KYC Documents'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default OrganizerRouteOnboarding;
