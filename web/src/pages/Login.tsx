import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import GoogleSignInButton from '../components/GoogleSignInButton';
import { User } from '../types';

interface LoginProps {
  onLogin: (token: string, user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('/auth/login', formData);
      const { token } = response.data;
      
      // Get user info (you might need to add this endpoint to your API)
      const userResponse = await axios.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      onLogin(token, userResponse.data.user);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = (token: string, userData: any) => {
    onLogin(token, userData);
  };

  const handleGoogleError = (error: string) => {
    setError(error);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-50 to-nature-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-gradient-to-br from-forest-600 to-nature-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">🌲</span>
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-forest-800">
            Welcome Back,
            <br/>
            <span className="text-nature-600">Adventurer!</span>
          </h2>
          <p className="mt-2 text-center text-sm text-forest-600">
            New to the tribe?{' '}
            <Link to="/register" className="font-medium text-nature-600 hover:text-forest-700 transition-colors">
              Join our community
            </Link>
          </p>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-forest-200">
          {/* Google Sign-In */}
          <div className="mb-6">
            <GoogleSignInButton 
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              text="Continue with Google"
              disabled={loading}
            />
            
            <div className="my-6 flex items-center">
              <div className="flex-grow border-t border-forest-200"></div>
              <span className="flex-shrink mx-4 text-forest-500 text-sm font-medium">or</span>
              <div className="flex-grow border-t border-forest-200"></div>
            </div>
          </div>
          
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            <div className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  📧 Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  🔐 Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-4 px-6 border border-transparent text-lg font-bold rounded-xl text-white bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700 focus:outline-none focus:ring-4 focus:ring-forest-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Entering the wilderness...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    🏕️ Enter the Tribe
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
