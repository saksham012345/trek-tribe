import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Tooltip } from '../components/ui/Tooltip';

const JoinTheTribe: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const startFlow = () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/subscribe' } } });
      return;
    }
    navigate('/subscribe', { state: { from: location } });
  };

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-6">
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-6 rounded-2xl shadow-xl">
        <p className="text-sm uppercase font-semibold">Partner Program</p>
        <h1 className="text-3xl font-bold mt-2">Join The Tribe – Become a Partner</h1>
        <p className="mt-2 text-emerald-50">List trips, get leads, and receive automatic payouts via Razorpay Route.</p>
        <button onClick={startFlow} className="mt-4 bg-white text-emerald-700 px-6 py-3 rounded-xl font-semibold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">Start Subscription</button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl border">
          <h3 className="font-semibold text-gray-900">1) Subscribe</h3>
          <p className="text-sm text-gray-600 mt-1">Unlock CRM, listings, and organizer tools with an active subscription.</p>
        </div>
        <div className="p-4 rounded-xl border">
          <h3 className="font-semibold text-gray-900">2) Connect Razorpay</h3>
          <p className="text-sm text-gray-600 mt-1">Onboard to Razorpay Route to receive payouts. Platform handles commission.</p>
        </div>
        <div className="p-4 rounded-xl border">
          <h3 className="font-semibold text-gray-900">3) Publish & Earn</h3>
          <p className="text-sm text-gray-600 mt-1">Publish trips, capture leads, and track payouts and settlements.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-gray-50 border">
          <h3 className="font-semibold text-gray-900">Organizer Benefits</h3>
          <ul className="mt-2 text-sm text-gray-700 space-y-1">
            <li>• Automatic payment splits (Route)</li>
            <li>• CRM dashboards with leads & tickets</li>
            <li>• Subscription-based access (no upfront costs)</li>
            <li>• Email/SMS templates and analytics</li>
          </ul>
        </div>
        <KycQuickForm />
      </div>
    </div>
  );
};

export default JoinTheTribe;

const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/i;

const KycQuickForm: React.FC = () => {
  const { add } = useToast();
  const [form, setForm] = useState({
    legalBusinessName: '',
    businessType: 'proprietorship',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.legalBusinessName.trim().length < 2) e.legalBusinessName = 'Business name must be at least 2 characters';
    if (!['proprietorship','partnership','llp','pvt_ltd'].includes(form.businessType)) e.businessType = 'Invalid business type';
    if (form.accountNumber.trim().length < 6 || form.accountNumber.trim().length > 20) e.accountNumber = 'Account number must be 6-20 digits';
    if (!ifscRegex.test(form.ifscCode)) e.ifscCode = 'Invalid IFSC (e.g., HDFC0001234)';
    if (form.accountHolderName.trim().length < 2) e.accountHolderName = 'Account holder name too short';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    // Local-only preview; actual onboarding happens server-side in /api/marketplace/organizer/onboard
    add('Looks good! Proceed to subscription, then onboarding.', 'success');
  };

  return (
    <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
      <h3 className="font-semibold text-emerald-900">Quick KYC Check</h3>
      <p className="text-sm text-emerald-800 mt-1">Validate basic details before onboarding. We never store bank data client-side.</p>
      <form onSubmit={onSubmit} className="mt-3 grid gap-3">
        <div>
          <label className="text-sm font-medium text-emerald-900">Legal Business Name</label>
          <input className="mt-1 w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-400" value={form.legalBusinessName} onChange={e=>setForm({...form, legalBusinessName: e.target.value})} placeholder="Acme Adventures Pvt Ltd" />
          {errors.legalBusinessName && <p className="text-red-600 text-xs mt-1">{errors.legalBusinessName}</p>}
        </div>
        <div>
          <label className="text-sm font-medium text-emerald-900">Business Type</label>
          <select className="mt-1 w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-400" value={form.businessType} onChange={e=>setForm({...form, businessType: e.target.value})}>
            <option value="proprietorship">Proprietorship</option>
            <option value="partnership">Partnership</option>
            <option value="llp">LLP</option>
            <option value="pvt_ltd">Private Limited</option>
          </select>
          {errors.businessType && <p className="text-red-600 text-xs mt-1">{errors.businessType}</p>}
        </div>
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-emerald-900">Account Number</label>
            <input className="mt-1 w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-400" value={form.accountNumber} onChange={e=>setForm({...form, accountNumber: e.target.value.replace(/\D/g,'')})} placeholder="1234567890" inputMode="numeric" />
            {errors.accountNumber && <p className="text-red-600 text-xs mt-1">{errors.accountNumber}</p>}
          </div>
          <div>
            <label className="text-sm font-medium text-emerald-900 flex items-center gap-2">
              IFSC Code
              <Tooltip text="We only store hashed identifiers and never your full bank details." />
            </label>
            <input className="mt-1 w-full rounded-lg border uppercase px-3 py-2 focus:ring-2 focus:ring-emerald-400" value={form.ifscCode} onChange={e=>setForm({...form, ifscCode: e.target.value.toUpperCase()})} placeholder="HDFC0001234" />
            {errors.ifscCode && <p className="text-red-600 text-xs mt-1">{errors.ifscCode}</p>}
          </div>
        </div>
        <div>
          <label className="text-sm font-medium text-emerald-900">Account Holder Name</label>
          <input className="mt-1 w-full rounded-lg border px-3 py-2 focus:ring-2 focus:ring-emerald-400" value={form.accountHolderName} onChange={e=>setForm({...form, accountHolderName: e.target.value})} placeholder="John Doe" />
          {errors.accountHolderName && <p className="text-red-600 text-xs mt-1">{errors.accountHolderName}</p>}
        </div>
        <button type="submit" className="mt-2 w-full bg-emerald-600 text-white px-4 py-2.5 rounded-lg font-semibold shadow-md hover:bg-emerald-700 hover:shadow-lg transition-all duration-200">Validate</button>
      </form>
    </div>
  );
};
