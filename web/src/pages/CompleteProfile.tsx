import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { useToast, ToastContainer } from '../components/Toast';

interface ProfileData {
  name: string;
  phone: string;
  bio?: string;
  location?: string;
}

const CompleteProfile: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useAuth();
  const { toasts, success, error: showErrorToast, removeToast } = useToast();
  
  const [loading, setLoading] = useState(false);
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

  const validatePhone = (phone: string): boolean => {
    const phoneRegex = /^[+]?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/\s/g, ''));
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<ProfileData> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Name must be at least 2 characters';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!validatePhone(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number (e.g., +919876543210)';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error for this field
    if (errors[name as keyof ProfileData]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      showErrorToast('Please fix the errors in the form');
      return;
    }

    setLoading(true);

    try {
      const cleanPhone = formData.phone.replace(/\s/g, '');
      
      await api.post('/auth/complete-profile', {
        name: formData.name.trim(),
        phone: cleanPhone,
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
          // Check if auto-pay setup is needed
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
      const errorMsg = error.response?.data?.error || 'Failed to complete profile';
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
                <div className="w-8 h-8 bg-nature-600 text-white rounded-full flex items-center justify-center font-semibold">
                  ✓
                </div>
                <span className="text-forest-700 font-medium">Account Created</span>
              </div>
              <div className="flex-1 h-1 bg-nature-200 mx-3" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-forest-600 text-white rounded-full flex items-center justify-center font-semibold">
                  2
                </div>
                <span className="text-forest-900 font-semibold">Profile Details</span>
              </div>
              {user?.role === 'organizer' && (
                <>
                  <div className="flex-1 h-1 bg-forest-200 mx-3" />
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-forest-200 text-forest-600 rounded-full flex items-center justify-center font-semibold">
                      3
                    </div>
                    <span className="text-forest-500">Auto-Pay Setup</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Form Card */}
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
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

            {/* Phone Field */}
            <div>
              <label htmlFor="phone" className="block text-sm font-semibold text-forest-700 mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <svg className="w-5 h-5 text-forest-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </div>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  placeholder="+919876543210"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full pl-12 pr-4 py-3.5 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition-all ${
                    errors.phone ? 'border-red-500' : 'border-forest-300'
                  }`}
                  disabled={loading}
                  required
                />
              </div>
              {errors.phone ? (
                <p className="mt-1 text-sm text-red-600">{errors.phone}</p>
              ) : (
                <p className="mt-1 text-xs text-forest-500">
                  Format: +[country code][number] (e.g., +919876543210)
                </p>
              )}
            </div>

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

            {/* Info Box for Organizers */}
            {user?.role === 'organizer' && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="text-sm text-blue-800">
                  <p className="font-medium mb-1">Next Step: Auto-Pay Setup</p>
                  <p>After completing your profile, you'll setup auto-pay to keep your trek listings active.</p>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-forest-600 to-nature-600 text-white font-semibold rounded-xl hover:from-forest-700 hover:to-nature-700 focus:outline-none focus:ring-2 focus:ring-forest-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Continue
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </span>
              )}
            </button>
          </form>

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
