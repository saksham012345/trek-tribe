import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AIChatWidget from './components/AIChatWidgetClean';
import CookieConsent from './components/CookieConsent';
import APIDebugger from './components/APIDebugger';
import FloatingJoinCTA from './components/FloatingJoinCTA';
import { Trip } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Lazy load heavy components to reduce initial bundle size
const Trips = React.lazy(() => import('./pages/Trips'));
const CreateTrip = React.lazy(() => import('./pages/CreateTrip'));
const EnhancedEditTrip = React.lazy(() => import('./pages/EnhancedEditTrip'));
const Profile = React.lazy(() => import('./pages/Profile'));
const TripDetails = React.lazy(() => import('./pages/TripDetails'));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard'));
const EnhancedProfile = React.lazy(() => import('./pages/EnhancedProfile'));
const EnhancedProfilePage = React.lazy(() => import('./pages/EnhancedProfilePage'));
const SearchPage = React.lazy(() => import('./pages/SearchPage'));
const AgentDashboard = React.lazy(() => import('./pages/AgentDashboard'));
const MyBookings = React.lazy(() => import('./pages/MyBookings'));
const Wishlist = React.lazy(() => import('./pages/Wishlist'));
const ForgotPassword = React.lazy(() => import('./components/auth/ForgotPassword'));
const ResetPassword = React.lazy(() => import('./components/auth/ResetPassword'));
const CookieSettings = React.lazy(() => import('./components/CookieSettings'));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy'));
const TermsConditions = React.lazy(() => import('./pages/TermsConditions'));
const AIShowcase = React.lazy(() => import('./pages/AIShowcase'));
const OrganizerCRM = React.lazy(() => import('./pages/OrganizerCRM'));
const ProfessionalCRMDashboard = React.lazy(() => import('./pages/ProfessionalCRMDashboard'));
const EnhancedCRMDashboard = React.lazy(() => import('./pages/EnhancedCRMDashboard'));
const PaymentVerificationDashboard = React.lazy(() => import('./pages/PaymentVerificationDashboard'));
const OrganizerRouteOnboarding = React.lazy(() => import('./pages/OrganizerRouteOnboarding'));
const OrganizerSettlements = React.lazy(() => import('./pages/OrganizerSettlements'));
const MarketplaceCheckout = React.lazy(() => import('./pages/MarketplaceCheckout'));
const JoinTheTribe = React.lazy(() => import('./pages/JoinTheTribe'));
const Subscribe = React.lazy(() => import('./pages/Subscribe'));

function AppContent() {
  const { user, loading, login: handleLogin, logout: handleLogout } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-forest-50">
        <Header user={user} onLogout={handleLogout} />
        <main className="pt-16">
          <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-50 to-nature-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-nature-600 mx-auto mb-4"></div>
                <p className="text-forest-700 font-medium">Loading adventure...</p>
              </div>
            </div>
          }>
          <Routes>
            <Route path="/" element={user ? <Navigate to="/home" /> : <Register onLogin={handleLogin} />} />
            <Route path="/home" element={user ? <Home user={user} /> : <Navigate to="/" />} />
            <Route
              path="/u/:userId"
              element={<EnhancedProfilePage />}
            />
            <Route
              path="/login"
              element={user ? <Navigate to="/home" /> : <Login onLogin={handleLogin} />} 
            />
            <Route 
              path="/register" 
              element={user ? <Navigate to="/home" /> : <Register onLogin={handleLogin} />} 
            />
            <Route path="/join-the-tribe" element={<JoinTheTribe />} />
            <Route 
              path="/subscribe" 
              element={
                user ? <Subscribe /> : <Navigate to="/login" state={{ from: { pathname: '/subscribe' } }} />
              } 
            />
            <Route 
              path="/organizer/subscriptions" 
              element={
                user ? <Subscribe /> : <Navigate to="/login" state={{ from: { pathname: '/organizer/subscriptions' } }} />
              } 
            />
            <Route 
              path="/forgot-password" 
              element={user ? <Navigate to="/" /> : <ForgotPassword />} 
            />
            <Route 
              path="/reset-password" 
              element={user ? <Navigate to="/" /> : <ResetPassword />} 
            />
            <Route path="/trips" element={user ? <Trips user={user} /> : <Navigate to="/" />} />
            <Route path="/trip/:id" element={user ? <TripDetails user={user} /> : <Navigate to="/" />} />
            <Route 
              path="/create-trip" 
              element={
                !user ? <Navigate to="/login" /> :
                user.role === 'organizer' || user.role === 'admin' ? <CreateTrip user={user} /> : 
                <Navigate to="/home?error=organizer-required" />
              } 
            />
            <Route 
              path="/edit-trip/:id" 
              element={user?.role === 'organizer' ? <EnhancedEditTrip /> : <Navigate to="/home" />}
            />
            <Route 
              path="/profile" 
              element={user ? <Profile user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/admin" 
              element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/home" />}
            />
            <Route 
              path="/agent" 
              element={user?.role === 'agent' || user?.role === 'admin' ? <AgentDashboard /> : <Navigate to="/home" />}
            />
            <Route 
              path="/profile/:userId" 
              element={<EnhancedProfilePage />} 
            />
            <Route 
              path="/my-profile" 
              element={user ? <EnhancedProfilePage /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/my-bookings" 
              element={user ? <MyBookings /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/wishlist" 
              element={user ? <Wishlist /> : <Navigate to="/login" />} 
            />
            <Route path="/search" element={user ? <SearchPage /> : <Navigate to="/login" />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms-conditions" element={<TermsConditions />} />
            <Route path="/cookie-settings" element={<CookieSettings />} />
            <Route path="/ai-showcase" element={user ? <AIShowcase /> : <Navigate to="/" />} />
            <Route
              path="/organizer/crm"
              element={
                !user ? <Navigate to="/login" /> :
                user.role === 'organizer' || user.role === 'admin' ? <ProfessionalCRMDashboard /> :
                <Navigate to="/home?error=organizer-required" />
              }
            />
            <Route
              path="/organizer/payment-verification"
              element={
                !user ? <Navigate to="/login" /> :
                user.role === 'organizer' || user.role === 'admin' ? <PaymentVerificationDashboard /> :
                <Navigate to="/home?error=organizer-required" />
              }
            />
            <Route
              path="/organizer/route-onboarding"
              element={
                !user ? <Navigate to="/login" /> :
                user.role === 'organizer' || user.role === 'admin' ? <OrganizerRouteOnboarding /> :
                <Navigate to="/home?error=organizer-required" />
              }
            />
            <Route
              path="/organizer/settlements"
              element={
                !user ? <Navigate to="/login" /> :
                user.role === 'organizer' || user.role === 'admin' ? <OrganizerSettlements /> :
                <Navigate to="/home?error=organizer-required" />
              }
            />
            <Route
              path="/checkout/marketplace"
              element={user ? <MarketplaceCheckout /> : <Navigate to="/login" />}
            />
          </Routes>
          </React.Suspense>
        </main>
        <FloatingJoinCTA />
        
        {/* AI Chat Support Widget */}
        <AIChatWidget />
        
        {/* Cookie Consent Banner */}
        <CookieConsent />
        
        {/* API Debugger - Remove in production */}
        {process.env.NODE_ENV === 'development' && <APIDebugger />}
      </div>
    </Router>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
