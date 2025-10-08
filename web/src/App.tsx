import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Header from './components/Header';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Trips from './pages/Trips';
import CreateTrip from './pages/CreateTrip';
import EnhancedEditTrip from './pages/EnhancedEditTrip';
import Profile from './pages/Profile';
import TripDetails from './pages/TripDetails';
import AdminDashboard from './pages/AdminDashboard';
import EnhancedProfile from './pages/EnhancedProfile';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import AgentDashboard from './pages/AgentDashboard';
import AIChatWidget from './components/AIChatWidget';
import { AuthProvider, useAuth } from './contexts/AuthContext';

axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

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
              path="/forgot-password" 
              element={user ? <Navigate to="/" /> : <ForgotPassword />} 
            />
            <Route 
              path="/reset-password" 
              element={user ? <Navigate to="/" /> : <ResetPassword />} 
            />
            <Route path="/trips" element={<Trips user={user} />} />
            <Route path="/trip/:id" element={<TripDetails user={user} />} />
            <Route 
              path="/create-trip" 
              element={user?.role === 'organizer' ? <CreateTrip user={user} /> : <Navigate to="/" />} 
            />
            <Route 
              path="/edit-trip/:id" 
              element={user?.role === 'organizer' ? <EnhancedEditTrip /> : <Navigate to="/" />} 
            />
            <Route 
              path="/profile" 
              element={user ? <Profile user={user} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/admin" 
              element={user?.role === 'admin' ? <AdminDashboard /> : <Navigate to="/" />} 
            />
            <Route 
              path="/agent" 
              element={user?.role === 'agent' || user?.role === 'admin' ? <AgentDashboard /> : <Navigate to="/" />} 
            />
            <Route 
              path="/profile/:userId" 
              element={<EnhancedProfile />} 
            />
            <Route 
              path="/my-profile" 
              element={user ? <EnhancedProfile /> : <Navigate to="/login" />} 
            />
          </Routes>
        </main>
        
        {/* AI Chat Support Widget */}
        <AIChatWidget />
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
