import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
        <button onClick={startFlow} className="mt-4 bg-white text-emerald-700 px-5 py-3 rounded-xl font-semibold shadow hover:-translate-y-0.5 transition">Start Subscription</button>
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
        <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
          <h3 className="font-semibold text-emerald-900">What to prepare</h3>
          <ul className="mt-2 text-sm text-emerald-800 space-y-1">
            <li>• Bank account & IFSC</li>
            <li>• Basic KYC documents</li>
            <li>• Trip details & pricing</li>
            <li>• Organizer support contact</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default JoinTheTribe;
