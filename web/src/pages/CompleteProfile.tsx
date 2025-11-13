import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { useToast, ToastContainer } from '../components/Toast';

interface ProfileData {
  name: string;
  phone?: string;
  bio?: string;
  location?: string;
}

const CompleteProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useAuth();
  const { toasts, success, error: showErrorToast, removeToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'profile' | 'verify'>('profile');
  const [verificationCode, setVerificationCode] = useState('');
  const [formData, setFormData] = useState<ProfileData>({
    name: user?.name || '',
    phone: '',
    bio: '',
    location: ''
  });
  const [errors, setErrors] = useState<Partial<ProfileData>>({});

  // Pre-fill with user data if available
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || prev.name,
        phone: user.phone || prev.phone
      }));
    }
  }, [user]);

  const validateForm = (): boolean => {
    const newErrors: Partial<ProfileData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSendVerificationCode = async () => {
    if (!validateForm()) {
      showErrorToast('Please fix the errors in the form');
      return;
    }

    setLoading(true);
    try {
      // Send verification email
      await api.post('/auth/send-verification-email');
      success('Verification code sent to your email!');
      setStep('verify');
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to send verification code';
      showErrorToast(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name as keyof ProfileData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleVerifyAndComplete = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      showErrorToast('Please enter the 6-digit verification code');
      return;
    }

    setLoading(true);

    try {
      // Verify email code
      await api.post('/auth/verify-email-code', {
        code: verificationCode
      });

      // Complete profile
      await api.post('/auth/complete-profile', {
        name: formData.name.trim(),
        phone: formData.phone?.trim() || undefined,
        bio: formData.bio?.trim() || undefined,
        location: formData.location?.trim() || undefined
      });

      success('Profile completed successfully!');
      
      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }

      // Redirect based on role and next step
      setTimeout(() => {
        if (user?.role === 'organizer') {
          const requiresAutoPay = (location.state as any)?.requiresAutoPay;
          if (requiresAutoPay) {
            navigate('/setup-auto-pay', { replace: true });
          } else {
            navigate('/organizer-dashboard', { replace: true });
          }
        } else {
          navigate('/', { replace: true });
        }
      }, 1000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Verification failed';
      showErrorToast(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-50 via-nature-50 to-forest-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto h-20 w-20 bg-gradient-to-br from-forest-600 to-nature-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-forest-900">
              Complete Your Profile
            </h2>
            <p className="mt-2 text-sm text-forest-600">
              Help us personalize your TrekTribe experience
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="bg-white rounded-xl shadow-md p-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  step === 'verify' ? 'bg-nature-600 text-white' : 'bg-forest-600 text-white'
                }`}>
                  1
                </div>
                <span className={step === 'verify' ? 'text-forest-700 font-medium' : 'text-forest-900 font-semibold'}>Role</span>
              </div>
              <div className={`flex-1 h-1 mx-3 ${
                step === 'verify' ? 'bg-nature-200' : 'bg-forest-200'
              }`} />
              <div className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                  step === 'verify' ? 'bg-forest-600 text-white' : 'bg-forest-200 text-forest-600'
                }`}>
                  2
                </div>
                <span className={step === 'verify' ? 'text-forest-900 font-semibold' : 'text-forest-500'}>Phone</span>
              </div>
              <div className="flex-1 h-1 bg-forest-200 mx-3" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-forest-200 text-forest-600 rounded-full flex items-center justify-center font-semibold">
                  3
                </div>
                <span className="text-forest-500">Verify</span>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            {/* Name Field */}
            <div>
              <label htmlFor="name" className="block text-sm font-semibold text-forest-700 mb-2">
                Full Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-forest-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Enter your full name"
                  value={formData.name}
                  onChange={handleChange}
                  className={`w-full pl-12 pr-4 py-3.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition-all ${
                    errors.name ? 'border-red-500' : 'border-forest-300'
                  }`}
                  disabled={loading}
                  required
                />
              </div>
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name}</p>
              )}
            </div>

            {step === 'profile' ? (
              /* Phone Number Field */
              <div>
                <label htmlFor="phone" className="block text-sm font-semibold text-forest-700 mb-2">
                  📱 Phone Number
                </label>
                <div className="relative">
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    placeholder="+1234567890"
                    value={formData.phone || ''}
                    onChange={handleChange}
                    className="w-full px-4 py-3.5 border-2 border-forest-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition-all"
                    disabled={loading}
                  />
                </div>
                <p className="mt-1 text-xs text-forest-500">
                  Include country code (e.g., +91 for India)
                </p>
              </div>
            ) : (
              /* Verification Code Field */
              <div>
                <label className="block text-sm font-semibold text-forest-700 mb-3 text-center">
                  Enter Verification Code
                </label>
                <p className="text-sm text-forest-600 text-center mb-4">
                  We've sent a 6-digit code to <span className="font-semibold">{user?.email}</span>
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full text-center text-2xl font-bold tracking-widest px-4 py-4 border-2 border-forest-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>
            )}

            {/* Location Field (Optional) */}
            <div>
              <label htmlFor="location" className="block text-sm font-semibold text-forest-700 mb-2">
                Location <span className="text-forest-400 text-xs">(Optional)</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-forest-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <input
                  id="location"
                  name="location"
                  type="text"
                  placeholder="e.g., Mumbai, India"
                  value={formData.location}
                  onChange={handleChange}
                  className="w-full pl-12 pr-4 py-3.5 border-2 border-forest-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition-all"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Bio Field (Optional) */}
            <div>
              <label htmlFor="bio" className="block text-sm font-semibold text-forest-700 mb-2">
                About You <span className="text-forest-400 text-xs">(Optional)</span>
              </label>
              <textarea
                id="bio"
                name="bio"
                rows={4}
                placeholder="Tell us a little about yourself and your interests..."
                value={formData.bio}
                onChange={handleChange}
                className="w-full px-4 py-3.5 border-2 border-forest-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition-all resize-none"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-forest-500 text-right">
                {formData.bio?.length || 0}/500 characters
              </p>
            </div>

            {/* Action Buttons */}
            {step === 'profile' ? (
              <button
                onClick={handleSendVerificationCode}
                disabled={loading}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold rounded-xl hover:from-forest-700 hover:to-nature-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Sending...
                  </span>
                ) : (
                  'Send Verification Code'
                )}
              </button>
            ) : (
              <div className="space-y-4">
                <button
                  onClick={handleVerifyAndComplete}
                  disabled={loading || verificationCode.length !== 6}
                  className="w-full py-3.5 px-4 bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold rounded-xl hover:from-forest-700 hover:to-nature-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Verifying...
                    </span>
                  ) : (
                    'Verify & Complete Profile'
                  )}
                </button>
                
                <button
                  onClick={() => setStep('profile')}
                  className="w-full text-forest-700 hover:text-forest-900 font-medium"
                >
                  ← Back
                </button>
              </div>
            )}
          </div>

          {/* Privacy Note */}
          <div className="text-center">
            <p className="text-xs text-forest-500">
              Your information is secure and will only be used to enhance your experience.{' '}
              <a href="/privacy" className="text-nature-600 hover:text-nature-700 font-medium">
                Privacy Policy
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default CompleteProfile;
