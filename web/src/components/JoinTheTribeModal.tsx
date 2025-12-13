import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  onStart?: () => void;
}

const JoinTheTribeModal: React.FC<Props> = ({ open, onClose, onStart }) => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const handleStartNow = () => {
    onClose();
    if (onStart) {
      onStart();
    } else {
      // Default behavior: navigate to subscribe page
      if (!user) {
        navigate('/login', { state: { from: { pathname: '/subscribe' } } });
      } else if (user.role === 'organizer') {
        navigate('/subscribe');
      } else {
        // Non-organizers need to register as organizer first
        navigate('/register', { state: { role: 'organizer' } });
      }
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full p-6 sm:p-8 space-y-4 animate-fade-in">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-emerald-600 font-semibold">Partner Program</p>
            <h2 className="text-2xl font-bold text-gray-900">Join The Tribe – Become a Partner</h2>
            <p className="text-gray-600 mt-1">Earn with TrekTribe by publishing trips, getting leads, and receiving automatic payouts.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-100">
            <h3 className="font-semibold text-emerald-800">How it works</h3>
            <ul className="mt-2 text-sm text-emerald-900 space-y-1">
              <li>• Connect Razorpay once</li>
              <li>• Platform takes commission, you get payouts</li>
              <li>• Subscriptions unlock CRM + listings</li>
              <li>• Route splits money automatically</li>
            </ul>
          </div>
          <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
            <h3 className="font-semibold text-gray-900">What you need</h3>
            <ul className="mt-2 text-sm text-gray-700 space-y-1">
              <li>• Active organizer subscription</li>
              <li>• Bank account details for payouts</li>
              <li>• Basic KYC docs</li>
              <li>• Trip details to publish</li>
            </ul>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
          <p className="text-sm text-gray-600">Already convinced? Start with subscription, then connect Razorpay to receive payouts.</p>
          <div className="flex gap-3">
            <button onClick={onClose} className="px-4 py-2 rounded-lg border text-gray-700 hover:bg-gray-50 transition-colors">Maybe later</button>
            <button onClick={handleStartNow} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 transition-colors shadow-md hover:shadow-lg">Start now</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinTheTribeModal;
