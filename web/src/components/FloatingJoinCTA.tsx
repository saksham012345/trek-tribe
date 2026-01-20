import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import JoinTheTribeModal from './JoinTheTribeModal';

const FloatingJoinCTA: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Don't show for premium organizers or on certain pages
  // Show for basic (non-premium) organizers so they can upgrade
  const shouldHide =
    (user?.role === 'organizer' && (user as any)?.isPremium) ||
    location.pathname.includes('/subscribe') ||
    location.pathname.includes('/login') ||
    location.pathname.includes('/register');

  if (shouldHide) {
    return null;
  }

  const handleClick = () => {
    if (!user) {
      navigate('/login', { state: { from: { pathname: '/subscribe' } } });
      return;
    }
    // If logged in, send to subscription flow first
    navigate('/subscribe', { state: { from: location } });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-36 right-4 z-40 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-3 rounded-full shadow-xl shadow-emerald-300/40 border border-white/20 transition transform hover:-translate-y-0.5"
      >
        Join The Tribe – Become a Partner
      </button>

      <JoinTheTribeModal
        open={open}
        onClose={() => setOpen(false)}
        onStart={() => {
          setOpen(false);
          handleClick();
        }}
      />
    </>
  );
};

export default FloatingJoinCTA;
