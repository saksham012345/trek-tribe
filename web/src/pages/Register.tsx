import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import RoleSelectModal from '../components/RoleSelectModal';
import GoogleLoginButton from '../components/GoogleLoginButton';
import PhoneVerificationModal from '../components/PhoneVerificationModal';

interface RegisterProps {
  onLogin: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
}

const Register: React.FC<RegisterProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    role: undefined as undefined | 'traveler' | 'organizer'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showPhoneVerification, setShowPhoneVerification] = useState(false);
  const [userId, setUserId] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [organizerDraft, setOrganizerDraft] = useState<{
    experience?: string;
    yearsOfExperience?: number;
    specialties?: string[];
    languages?: string[];
    bio?: string;
  } | undefined>(undefined);

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    // Clear error when user starts typing (indicates they're trying again)
    if (error) {
      setError('');
    }
    
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Don't clear error immediately - only clear when user starts typing

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/register', {
        name: formData.name,
        email: formData.email,
        phone: formData.phoneNumber,
        password: formData.password,
        role: formData.role || 'traveler'
      });

      const responseData = response.data as any;
      
      // Registration successful, now verify phone
      if (responseData.requiresVerification && responseData.userId) {
        setUserId(responseData.userId);
        
        // Show dev OTP if available
        if (responseData.otp) {
          setDevOtp(responseData.otp);
        }
        
        // Show phone verification modal
        setShowPhoneVerification(true);
        setError('');
        return;
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

  const handlePhoneVerified = async () => {
    setShowPhoneVerification(false);
    
    // Phone verified, now login
    try {
      const result = await onLogin(formData.email, formData.password);
      if (result.success) {
        // If organizer, push initial organizer basics
        if ((formData.role === 'organizer') && organizerDraft) {
          try {
            await api.put('/profile/me', {
              organizerProfile: {
                experience: organizerDraft.experience,
                yearsOfExperience: organizerDraft.yearsOfExperience,
                specialties: organizerDraft.specialties,
                languages: organizerDraft.languages,
                bio: organizerDraft.bio,
              }
            });
          } catch {}
        }
        navigate('/my-profile', { replace: true });
      } else if (result.error) {
        setError(result.error);
        navigate('/login', { replace: true });
      }
    } catch (error) {
      setError('Login failed after verification. Please try logging in.');
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-forest-50 via-white to-nature-50">
      {/* Hero */}
      <div className="bg-gradient-to-r from-forest-700 to-nature-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-10 flex items-center justify-between">
          <div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">Join TrekTribe</h1>
            <p className="text-white/90 mt-1">Create your adventure profile and start exploring curated treks.</p>
          </div>
          <div className="hidden sm:block text-5xl">🏔️</div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 pb-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Left: Brand card */}
          <div className="hidden lg:block">
            <div className="bg-white rounded-2xl shadow-xl p-8 border border-forest-200">
              <h3 className="text-xl font-bold text-forest-800 mb-4">Why TrekTribe?</h3>
              <ul className="space-y-3 text-forest-700">
                <li>• Verified organizers and real reviews</li>
                <li>• Curated itineraries and transparent pricing</li>
                <li>• Secure bookings with support from real agents</li>
                <li>• Build your adventure profile and earn badges</li>
              </ul>
            </div>
          </div>

          {/* Right: Form card */}
          <div className="w-full space-y-6 sm:space-y-8">
            <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-xl p-6 sm:p-8 border border-forest-200">
          {/* Google Sign-Up - only show if not logged in */}
          {!user && (
            <div className="space-y-3 mb-4">
              <GoogleLoginButton 
                className="w-full"
                onError={(msg) => setError(msg || 'Google sign-in failed')}
                onSuccess={() => {
                  setError('');
                  // After Google sign-in, collect role basics
                  setShowRoleModal(true);
                }}
              />
              <div className="flex items-center gap-2">
                <div className="h-px bg-forest-200 flex-1" />
                <span className="text-forest-500 text-sm">or</span>
                <div className="h-px bg-forest-200 flex-1" />
              </div>
            </div>
          )}

          <RoleSelectModal 
            open={showRoleModal}
            onClose={() => setShowRoleModal(false)}
            onSelect={(role, data) => {
              setFormData(prev => ({ ...prev, role }));
              setOrganizerDraft(data);
              setShowRoleModal(false);
            }}
          />
          
          <PhoneVerificationModal
            open={showPhoneVerification}
            phone={formData.phoneNumber}
            userId={userId}
            onVerified={handlePhoneVerified}
            onClose={() => {
              setShowPhoneVerification(false);
              setError('Registration cancelled. Please try again.');
            }}
            initialDevOtp={devOtp}
          />
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
                  placeholder="+1234567890 (include country code)"
                />
                <p className="text-xs text-forest-600 mt-1">You'll receive an SMS verification code</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  🎯 Join as
                </label>
                <div className="flex gap-3">
                  <button type="button" onClick={() => setShowRoleModal(true)} className="px-4 py-2 border-2 border-forest-200 rounded-xl hover:border-nature-500 hover:bg-nature-50 transition">Select role</button>
                  {formData.role && (
                    <span className="px-3 py-2 bg-forest-100 text-forest-700 rounded-xl text-sm">{formData.role === 'traveler' ? 'Adventurer' : 'Organizer'} selected</span>
                  )}
                </div>
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
      </div>
    </div>
  );
};

export default Register;
