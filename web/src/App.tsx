import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Header from './components/Header';
import RealTimeChatWidget from './components/RealTimeChatWidget';
import AgentChatDashboard from './components/AgentChatDashboard';
import CookieConsent from './components/CookieConsent';
import Footer from './components/Footer';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Trips from './pages/Trips';
import CreateTrip from './pages/CreateTrip';
import EditTrip from './pages/EditTrip';
import Profile from './pages/Profile';
import TripTracking from './pages/TripTracking';
import AuthCallback from './pages/AuthCallback';
import AdminDashboard from './pages/AdminDashboard';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import CookieSettings from './pages/CookieSettings';
import DataManagement from './pages/DataManagement';
import { User } from './types';

axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

function AppContent() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      // Set default authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      // Verify token and get user info
      axios.get('/auth/me')
        .then(response => {
          setUser(response.data.user);
        })
        .catch(() => {
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (token: string, userData: User) => {
    localStorage.setItem('token', token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-50">
        <Header user={user} onLogout={handleLogout} />
        <main className="pt-16">
          <Routes>
            <Route path="/" element={<Home user={user} />} />
            <Route 
              path="/login" 
              element={user ? <Navigate to="/" /> : <Login onLogin={handleLogin} />} 
            />
            <Route 
              path="/register" 
              element={user ? <Navigate to="/" /> : <Register onLogin={handleLogin} />} 
            />
            <Route 
              path="/auth/callback" 
              element={<AuthCallback onLogin={handleLogin} />} 
            />
            <Route 
              path="/auth/error" 
              element={<Navigate to="/login" />} 
            />
            <Route path="/trips" element={<Trips user={user} />} />
            <Route 
              path="/create-trip" 
              element={user?.role === 'organizer' ? <CreateTrip user={user} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/edit-trip/:id" 
              element={user?.role === 'organizer' ? <EditTrip user={user} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/profile" 
              element={user ? <Profile user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/trip-tracking/:tripId" 
              element={user ? <TripTracking user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/admin" 
              element={user && (user.role === 'admin' || user.role === 'agent') ? <AdminDashboard user={user} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/agent/chat" 
              element={user && user.role === 'agent' ? <AgentChatDashboard onAuthRequired={() => window.location.href = '/login'} /> : <Navigate to="/" />} 
            />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<TermsAndConditions />} />
            <Route path="/cookie-settings" element={<CookieSettings />} />
            <Route 
              path="/data-management" 
              element={user ? <DataManagement /> : <Navigate to="/login" />} 
            />
          </Routes>
        </main>
        
        {/* Real-time Chat Widget - Available on all pages except agent chat dashboard */}
        {location.pathname !== '/agent/chat' && (
          <RealTimeChatWidget 
            isAuthenticated={!!user} 
            onAuthRequired={() => window.location.href = '/login'} 
          />
        )}
        
        {/* Cookie Consent Banner */}
        <CookieConsent />
        
        {/* Footer */}
        <Footer />
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
