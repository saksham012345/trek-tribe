import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import AIChatWidget from './components/AIChatWidgetClean';
import CookieConsent from './components/CookieConsent';
import APIDebugger from './components/APIDebugger';
import FloatingJoinCTA from './components/FloatingJoinCTA';
import { Trip } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { preloadRazorpay } from './utils/razorpay';

// Retry logic for lazy loading chunks
const retryLazyLoad = (
  componentImport: () => Promise<any>,
  retries = 3,
  interval = 1000
): Promise<{ default: React.ComponentType<any> }> => {
  return new Promise((resolve, reject) => {
    componentImport()
      .then(resolve)
      .catch((error) => {
        setTimeout(() => {
          if (retries === 1) {
            // Final retry failed, force reload
            window.location.reload();
            reject(error);
            return;
          }
          retryLazyLoad(componentImport, retries - 1, interval).then(resolve, reject);
        }, interval);
      });
  });
};

// Lazy load heavy components with retry logic
const Trips = React.lazy(() => retryLazyLoad(() => import('./pages/Trips')));
const CreateTrip = React.lazy(() => retryLazyLoad(() => import('./pages/CreateTrip')));
const EnhancedEditTrip = React.lazy(() => retryLazyLoad(() => import('./pages/EnhancedEditTrip')));
const Profile = React.lazy(() => retryLazyLoad(() => import('./pages/Profile')));
const TripDetails = React.lazy(() => retryLazyLoad(() => import('./pages/TripDetails')));
const AdminDashboard = React.lazy(() => retryLazyLoad(() => import('./pages/AdminDashboard')));
const EnhancedProfile = React.lazy(() => retryLazyLoad(() => import('./pages/EnhancedProfile')));
const EnhancedProfilePage = React.lazy(() => retryLazyLoad(() => import('./pages/EnhancedProfilePage')));
const SearchPage = React.lazy(() => retryLazyLoad(() => import('./pages/SearchPage')));
const AgentDashboard = React.lazy(() => retryLazyLoad(() => import('./pages/AgentDashboard')));
const MyBookings = React.lazy(() => retryLazyLoad(() => import('./pages/MyBookings')));
const Wishlist = React.lazy(() => retryLazyLoad(() => import('./pages/Wishlist')));
const ForgotPassword = React.lazy(() => retryLazyLoad(() => import('./components/auth/ForgotPassword')));
const ResetPassword = React.lazy(() => retryLazyLoad(() => import('./components/auth/ResetPassword')));
const CookieSettings = React.lazy(() => retryLazyLoad(() => import('./components/CookieSettings')));
const PrivacyPolicy = React.lazy(() => retryLazyLoad(() => import('./pages/PrivacyPolicy')));
const TermsConditions = React.lazy(() => retryLazyLoad(() => import('./pages/TermsConditions')));
const AIShowcase = React.lazy(() => retryLazyLoad(() => import('./pages/AIShowcase')));
const OrganizerCRM = React.lazy(() => retryLazyLoad(() => import('./pages/OrganizerCRM')));
const ProfessionalCRMDashboard = React.lazy(() => retryLazyLoad(() => import('./pages/ProfessionalCRMDashboard')));
const EnhancedCRMDashboard = React.lazy(() => retryLazyLoad(() => import('./pages/EnhancedCRMDashboard')));
const CRMDashboard = React.lazy(() => retryLazyLoad(() => import('./pages/CRMDashboard')));
const PaymentVerificationDashboard = React.lazy(() => retryLazyLoad(() => import('./pages/PaymentVerificationDashboard')));
const OrganizerRouteOnboarding = React.lazy(() => retryLazyLoad(() => import('./pages/OrganizerRouteOnboarding')));
const OrganizerSettlements = React.lazy(() => retryLazyLoad(() => import('./pages/OrganizerSettlements')));
const MarketplaceCheckout = React.lazy(() => retryLazyLoad(() => import('./pages/MarketplaceCheckout')));
const JoinTheTribe = React.lazy(() => retryLazyLoad(() => import('./pages/JoinTheTribe')));
const Subscribe = React.lazy(() => retryLazyLoad(() => import('./pages/Subscribe')));
const AdminOrganizerVerification = React.lazy(() => retryLazyLoad(() => import('./pages/AdminOrganizerVerification')));

// Error Boundary for lazy loading failures
class ChunkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    if (error.name === 'ChunkLoadError') {
      console.error('Chunk load error detected, reloading page...');
      window.location.reload();
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-forest-50">
          <div className="text-center p-8">
            <h2 className="text-2xl font-bold text-forest-900 mb-4">Loading...</h2>
            <p className="text-forest-700">The page will refresh automatically.</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, loading, login: handleLogin, logout: handleLogout } = useAuth();

  // Preload Razorpay SDK for faster payment flow
  useEffect(() => {
    preloadRazorpay();
  }, []);

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-forest-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-nature-300 border-t-nature-600 mx-auto mb-4"></div>
          <p className="text-forest-700 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="min-h-screen bg-forest-50 flex flex-col font-sans text-forest-900 selection:bg-earth-200 selection:text-forest-900">
        <Header user={user} onLogout={handleLogout} />
        <main className="pt-16 flex-grow relative z-0">
          <React.Suspense fallback={
            <div className="min-h-[60vh] flex items-center justify-center bg-forest-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-earth-200 border-t-forest-600 mx-auto mb-4"></div>
                <p className="text-forest-600 font-medium tracking-wide">Prepare for adventure...</p>
              </div>
            </div>
          }>
            <Routes>
              {/* Default route - redirect to login if not authenticated, home if authenticated */}
              <Route
                path="/"
                element={user ? <Navigate to="/home" replace /> : <Navigate to="/login" replace />}
              />
              {/* Home route - requires authentication */}
              <Route
                path="/home"
                element={user ? <Home user={user} /> : <Navigate to="/login" replace />}
              />
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
              <Route path="/trips" element={user ? <Trips user={user} /> : <Navigate to="/login" />} />
              <Route path="/trip/:id" element={user ? <TripDetails user={user} /> : <Navigate to="/login" />} />
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
                path="/admin/dashboard"
                element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/home" />}
              />
              <Route
                path="/admin/organizer-verification"
                element={user?.role === 'admin' ? <AdminOrganizerVerification /> : <Navigate to="/home" />}
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
                path="/crm"
                element={
                  !user ? <Navigate to="/login" /> :
                    user.role === 'organizer' || user.role === 'admin' ? <CRMDashboard /> :
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
              {/* Route onboarding disabled - using simplified bank details collection instead */}
              {/* <Route
              path="/organizer/route-onboarding"
              element={
                !user ? <Navigate to="/login" /> :
                user.role === 'organizer' || user.role === 'admin' ? <OrganizerRouteOnboarding /> :
                <Navigate to="/home?error=organizer-required" />
              }
            /> */}
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
        <Footer />
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
    <ChunkErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ChunkErrorBoundary>
  );
}

export default App;
