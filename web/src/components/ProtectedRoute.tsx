import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  allowedRoles?: Array<'traveler' | 'organizer' | 'admin' | 'agent'>;
  redirectTo?: string;
}

/**
 * ProtectedRoute component for centralized route protection
 * 
 * Usage:
 * <ProtectedRoute requireAuth allowedRoles={['admin']}>
 *   <AdminDashboard />
 * </ProtectedRoute>
 */
const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAuth = true,
  allowedRoles,
  redirectTo = '/login'
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-forest-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nature-600"></div>
      </div>
    );
  }

  // Require authentication
  if (requireAuth && !user) {
    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Require specific roles
  if (allowedRoles && user && !allowedRoles.includes(user.role as any)) {
    // Redirect to home if user doesn't have required role
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;

