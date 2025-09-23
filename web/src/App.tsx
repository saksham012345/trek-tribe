import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import Header from './components/Header';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Trips from './pages/Trips';
import CreateTrip from './pages/CreateTrip';
import EditTrip from './pages/EditTrip';
import Profile from './pages/Profile';
import TripTracking from './pages/TripTracking';

axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'traveler' | 'organizer' | 'admin';
}

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

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
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
