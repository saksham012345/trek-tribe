import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface EmailVerificationGuardProps {
  children: React.ReactNode;
}

// Routes that don't require email verification
const WHITELISTED_ROUTES = [
  '/verify-email',
  '/login',
  '/register',
  '/logout',
  '/forgot-password',
  '/reset-password',
  '/join-the-tribe',
  '/privacy-policy',
  '/terms-conditions',
  '/cookie-settings'
];

const EmailVerificationGuard: React.FC<EmailVerificationGuardProps> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  // Check if current route is whitelisted
  const isWhitelisted = WHITELISTED_ROUTES.some(route => 
    location.pathname === route || location.pathname.startsWith(route)
  );

  // Allow whitelisted routes
  if (isWhitelisted) {
    return <>{children}</>;
  }

  // Allow admins and agents to bypass verification
  if (user && (user.role === 'admin' || user.role === 'agent')) {
    return <>{children}</>;
  }

  // Redirect unverified users to verification page
  if (user && user.emailVerified === false) {
    return <Navigate to="/verify-email" replace />;
  }

  // Allow verified users
  return <>{children}</>;
};

export default EmailVerificationGuard;
