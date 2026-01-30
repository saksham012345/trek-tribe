import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { Phone, Check, AlertCircle, ArrowRight, User as UserIcon, Loader2 } from 'lucide-react';
import debounce from 'lodash/debounce';

const CompleteProfile: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // States
  const [step, setStep] = useState<'username' | 'phone' | 'otp' | 'completed'>('loading');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Phone verification state
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [timer, setTimer] = useState(0);

  // Username state
  const [username, setUsername] = useState('');
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Determine initial step
  useEffect(() => {
    if (user) {
      if (!user.username) {
        setStep('username');
      } else if (!user.phoneVerified) {
        setStep('phone');
        // Pre-fill phone if available but unverified
        if (user.phone) setPhone(user.phone);
      } else {
        // All good
        setStep('completed');
        const from = (location.state as any)?.from?.pathname || '/';
        if (location.pathname === '/complete-profile') {
          navigate(from === '/complete-profile' ? '/' : from, { replace: true });
        }
      }
    }
  }, [user, navigate, location]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Username Logic
  const checkUsername = async (val: string) => {
    if (!val || val.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setIsCheckingUsername(true);
    try {
      const response = await api.get(`/api/users/check-username?username=${val}`);
      setUsernameAvailable(response.data.available);
      if (!response.data.available) {
        setError(response.data.message || 'Username taken');
      } else {
        setError('');
      }
    } catch (err) {
      setUsernameAvailable(false);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  // Debounce username check
  const debouncedCheck = React.useCallback(debounce(checkUsername, 500), []);

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '');
    setUsername(val);
    setUsernameAvailable(null);
    setError('');
    debouncedCheck(val);
  };

  const handleSetUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameAvailable) return;

    setLoading(true);
    try {
      await api.post('/api/users/set-username', { username });
      await refreshUser(); // Refresh checks user state, useEffect determines next step
      setSuccess('Username set successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to set username');
    } finally {
      setLoading(false);
    }
  };

  // Phone Logic
  // Phone Logic - CHANGED: Direct save, no OTP (Verification skipped for now)
  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    let formattedPhone = phone;
    // Basic formatting if needed, though backend often handles it or validation
    if (!phone.startsWith('+')) {
      if (!phone.startsWith('91') && phone.length === 10) {
        formattedPhone = '+91' + phone;
      } else {
        formattedPhone = '+' + phone;
      }
    }

    setLoading(true);
    try {
      // Use complete-profile to save phone and auto-verify
      const response = await api.post('/auth/complete-profile', {
        phone: formattedPhone,
        role: user?.role || 'traveler' // Ensure role is passed
      });

      setSuccess('Phone number saved!');
      await refreshUser(); // This should update user state and trigger useEffect to move to 'completed'
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Failed to save phone number.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const response = await api.post('/auth/phone/verify-otp', { otp, phone });
      if (response.data.success) {
        setSuccess('Phone verified!');
        await refreshUser();
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid verification code.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'loading' || step === 'completed') {
    return (
      <div className="min-h-screen bg-forest-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-forest-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-forest-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="bg-forest-900 p-6 text-center">
          <h2 className="text-2xl font-bold text-white mb-2">Complete Your Profile</h2>
          <p className="text-forest-200 text-sm">
            {step === 'username' ? 'Choose a unique username' : 'Verify your phone number'}
          </p>
        </div>

        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-lg flex items-start gap-3">
              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <p className="text-sm text-green-700">{success}</p>
            </div>
          )}

          {step === 'username' && (
            <form onSubmit={handleSetUsername} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <UserIcon className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    value={username}
                    onChange={handleUsernameChange}
                    placeholder="explorer-jane"
                    className={`block w-full pl-10 pr-10 py-3 border rounded-xl focus:ring-forest-500 focus:border-forest-500 transition-colors ${usernameAvailable === true ? 'border-green-500' :
                      usernameAvailable === false ? 'border-red-500' : 'border-gray-300'
                      }`}
                    required
                    minLength={3}
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                    {isCheckingUsername ? (
                      <Loader2 className="h-5 w-5 text-gray-400 animate-spin" />
                    ) : usernameAvailable === true ? (
                      <Check className="h-5 w-5 text-green-500" />
                    ) : usernameAvailable === false ? (
                      <AlertCircle className="h-5 w-5 text-red-500" />
                    ) : null}
                  </div>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  This will be your public profile URL: trektribe.in/u/{username || 'username'}
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || !usernameAvailable}
                className="w-full flex items-center justify-center gap-2 bg-forest-600 hover:bg-forest-700 text-white font-medium py-3 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Continue'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}

          {step === 'phone' && (
            <form onSubmit={handleSavePhone} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Phone className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/[^0-9+]/g, ''))}
                    placeholder="+91 98765 43210"
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-xl focus:ring-forest-500 focus:border-forest-500 transition-colors"
                    required
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Phone number is required for coordinating trips.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 bg-forest-600 hover:bg-forest-700 text-white font-medium py-3 rounded-xl transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Saving...' : 'Save & Continue'}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>
            </form>
          )}


        </div>
      </div>
    </div>
  );
};

export default CompleteProfile;
