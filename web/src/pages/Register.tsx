import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../config/api';

interface RegisterProps {
  onLogin: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
}

const Register: React.FC<RegisterProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    role: 'traveler' as 'traveler' | 'organizer'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        password: formData.password,
        role: formData.role
      });
      
      // Registration now returns both token and user data, so we can login directly
      const responseData = response.data as { token: string; user: any };
      if (responseData.token && responseData.user) {
        localStorage.setItem('token', responseData.token);
        // Trigger auth context update by calling a login attempt
        const result = await onLogin(formData.email, formData.password);
        if (result.success) {
          // Redirect to home page after successful registration and login
          navigate('/', { replace: true });
        } else if (result.error) {
          setError(result.error);
        }
      } else {
        setError('Registration successful but login failed. Please try logging in manually.');
      }
    } catch (error: any) {
      console.log('Registration error details:', error);
      if (error.response?.data?.error) {
        let errorMessage = '';
        if (typeof error.response.data.error === 'object') {
          // Handle Zod validation errors
          const validationErrors = error.response.data.error.fieldErrors || error.response.data.error;
          const errorMessages = Object.values(validationErrors).flat();
          errorMessage = errorMessages.join(', ');
        } else {
          errorMessage = error.response.data.error;
        }
        
        // Provide better guidance for common errors
        if (errorMessage.includes('Email already in use')) {
          setError('This email is already registered. Try logging in instead, or use a different email address.');
        } else {
          setError(errorMessage);
        }
      } else if (error.message) {
        setError(`Connection error: ${error.message}. Please make sure you have a stable internet connection.`);
      } else {
        setError('Registration failed. Please check your information and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-50 to-nature-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 sm:h-16 sm:w-16 bg-gradient-to-br from-forest-600 to-nature-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl sm:text-2xl">🌲</span>
          </div>
          <h2 className="mt-4 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-forest-800">
            Join the 
            <span className="text-nature-600">Adventure</span>
          </h2>
          <p className="mt-2 text-center text-sm text-forest-600">
            Already part of the tribe?{' '}
            <Link to="/login" className="font-medium text-nature-600 hover:text-forest-700 transition-colors">
              Sign in to your account
            </Link>
          </p>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 sm:p-8 border border-forest-200">
          <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <span className="text-sm">{error}</span>
              </div>
            )}
          
            <div className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  👤 Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="Enter your full name"
                />
              </div>
              
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
                <label htmlFor="phoneNumber" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  📱 Phone Number
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="Enter your phone number"
                />
              </div>
              
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  🎯 Choose your adventure style
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50 appearance-none"
                >
                  <option value="traveler">🎒 Join adventures as an explorer</option>
                  <option value="organizer">🗺️ Lead and organize epic journeys</option>
                </select>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  🔐 Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="Create a secure password"
                />
              </div>
              
              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  ✅ Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="Confirm your password"
                />
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 sm:py-4 px-4 sm:px-6 border border-transparent text-base sm:text-lg font-bold rounded-xl text-white bg-gradient-to-r from-nature-600 to-forest-600 hover:from-nature-700 hover:to-forest-700 focus:outline-none focus:ring-4 focus:ring-nature-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Creating your adventure profile...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    🌱 Join the Tribe
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

export default Register;
