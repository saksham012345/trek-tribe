import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import RoleSelectModal from '../components/RoleSelectModal';
import GoogleLoginButton from '../components/GoogleLoginButton';
import EmailVerificationModal from '../components/EmailVerificationModal';

interface RegisterProps {
  onLogin: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
}

const Register: React.FC<RegisterProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    email: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    role: undefined as undefined | 'traveler' | 'organizer'
  });
  const [error, setError] = useState('');
  const [passwordHint, setPasswordHint] = useState('Use at least 10 characters with upper, lower, number, and symbol.');
  const [loading, setLoading] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);
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

  const slugifyUsername = (value: string) => {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9-_]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const validateUsername = (value: string) => {
    const candidate = slugifyUsername(value);
    if (!candidate || candidate.length < 3) return { valid: false, message: 'Username must be at least 3 characters.' };
    if (candidate.length > 30) return { valid: false, message: 'Username must be under 30 characters.' };
    if (!/^[a-z0-9-_]+$/.test(candidate)) return { valid: false, message: 'Only letters, numbers, hyphens, and underscores allowed.' };
    return { valid: true, value: candidate };
  };

  const checkUsernameAvailability = async (rawValue?: string) => {
    const candidate = validateUsername(rawValue ?? formData.username);
    if (!candidate.valid) {
      setUsernameStatus('invalid');
      setError(candidate.message || 'Please choose a valid username.');
      return false;
    }

    setError('');
    setUsernameStatus('checking');

    try {
      await api.get(`/public/${candidate.value}`);
      // If we got 200, username already exists
      setUsernameStatus('taken');
      setError('This username is already taken. Try another one.');
      return false;
    } catch (availabilityError: any) {
      if (availabilityError?.response?.status === 404) {
        setUsernameStatus('available');
        return true;
      }
      setUsernameStatus('invalid');
      setError('Unable to check username availability. Please try again.');
      return false;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    // Clear error when user starts typing (indicates they're trying again)
    if (error) {
      setError('');
    }
    const { name, value } = e.target;

    if (name === 'username') {
      const slugged = slugifyUsername(value);
      setFormData({
        ...formData,
        username: slugged
      });
      setUsernameStatus('idle');
      return;
    }

    setFormData({
      ...formData,
      [name]: value
    });

    if (name === 'password') {
      const checks = [
        /[A-Z]/.test(value),
        /[a-z]/.test(value),
        /[0-9]/.test(value),
        /[^A-Za-z0-9]/.test(value),
        value.length >= 10,
      ];
      const score = checks.filter(Boolean).length;
      if (score >= 5) {
        setPasswordHint('Looks good! Strong password.');
      } else {
        setPasswordHint('Your password must include upper/lowercase letters, a number, a symbol, and be at least 10 characters.');
      }
    }
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

    const usernameOk = await checkUsernameAvailability();
    if (!usernameOk) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.post('/auth/register', {
        name: formData.name,
        username: formData.username,
        email: formData.email,
        phone: formData.phoneNumber,
        password: formData.password,
        role: formData.role || 'traveler'
      });

      const responseData = response.data as any;
      
      // Registration successful, now verify email
      if (responseData.requiresVerification && responseData.userId) {
        setUserId(responseData.userId);
        
        // Show dev OTP if available
        if (responseData.otp) {
          setDevOtp(responseData.otp);
        }
        
        // Show email verification modal
        setShowEmailVerification(true);
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

  const handleEmailVerified = async () => {
    setShowEmailVerification(false);
    
    // Phone verified, now login
    try {
      const result = await onLogin(formData.email, formData.password);
      if (result.success) {
        // Reserve unique URL immediately after login
        try {
          const baseName = validateUsername(formData.username).valid ? slugifyUsername(formData.username) : slugifyUsername(formData.name);
          const targetUserId = userId || (await api.get('/auth/me')).data?.user?._id;
          if (targetUserId) {
            const claimResponse = await api.post(`/public/generate-url/${targetUserId}`, { baseName });
            const claimedSlug = claimResponse?.data?.data?.suggestion || baseName;
            if (formData.role === 'organizer') {
              await api.put('/profile/enhanced', {
                organizerProfile: {
                  uniqueUrl: claimedSlug
                }
              });
            }
          }
        } catch (claimError) {
          console.warn('Unique URL claim skipped:', claimError);
        }
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
        // After successful registration & auto-login, redirect to homepage
        navigate('/', { replace: true });
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
          
          <EmailVerificationModal
            open={showEmailVerification}
            email={formData.email}
            userId={userId}
            onVerified={handleEmailVerified}
            onClose={() => {
              setShowEmailVerification(false);
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
                <label htmlFor="username" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  🔗 Username (profile URL)
                </label>
                <input
                  id="username"
                  name="username"
                  type="text"
                  value={formData.username}
                  onChange={handleChange}
                  onBlur={() => checkUsernameAvailability(formData.username)}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="e.g., trekker-jane"
                  required
                />
                <p className="text-xs text-forest-600 mt-1">
                  This becomes your profile link: trektribe.com/profile/{formData.username || 'your-name'}
                  {usernameStatus === 'checking' && ' • Checking availability...'}
                  {usernameStatus === 'available' && ' • Available!'}
                  {usernameStatus === 'taken' && ' • Already taken'}
                </p>
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
                  📱 Phone Number <span className="text-xs text-gray-500">(Optional)</span>
                </label>
                <input
                  id="phoneNumber"
                  name="phoneNumber"
                  type="tel"
                  autoComplete="tel"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="+1234567890 (include country code)"
                />
                <p className="text-xs text-forest-600 mt-1">You'll receive an email verification code</p>
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
                <p className="text-xs text-forest-600 mt-1">{passwordHint}</p>
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
