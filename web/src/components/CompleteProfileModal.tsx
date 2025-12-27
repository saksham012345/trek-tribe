import React, { useState, useEffect } from 'react';
import api from '../config/api';

interface CompleteProfileModalProps {
  open: boolean;
  onComplete: () => void;
  userEmail: string;
}

const CompleteProfileModal: React.FC<CompleteProfileModalProps> = ({ open, onComplete, userEmail }) => {
  const [step, setStep] = useState<'role' | 'phone' | 'verify'>('role');
  const [role, setRole] = useState<'traveler' | 'organizer' | null>(null);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState(''); // For development mode

  // Organizer-specific fields
  const [experience, setExperience] = useState('');
  const [years, setYears] = useState<number | ''>('');
  const [specialties, setSpecialties] = useState('');
  const [languages, setLanguages] = useState('');
  const [bio, setBio] = useState('');

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!open) return null;

  const handleRoleSelect = (selectedRole: 'traveler' | 'organizer') => {
    setRole(selectedRole);
    setError('');
    setStep('phone');
  };

  const handleSendOtp = async () => {
    if (!phone || phone.length < 10) {
      setError('Please enter a valid phone number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/verify-phone/send-otp', { phone });
      setOtpSent(true);
      setCountdown(60);
      setStep('verify');
      
      // In dev mode, show OTP
      if (response.data.otp) {
        setDevOtp(response.data.otp);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/verify-phone/verify-otp', { phone, otp });
      
      // Now complete the profile
      await handleCompleteProfile();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Invalid OTP');
      setLoading(false);
    }
  };

  const handleCompleteProfile = async () => {
    try {
      const profileData: any = {
        role,
        phone
      };

      if (role === 'organizer') {
        profileData.organizerProfile = {
          experience: experience || undefined,
          yearsOfExperience: typeof years === 'number' ? years : undefined,
          specialties: specialties ? specialties.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          languages: languages ? languages.split(',').map(s => s.trim()).filter(Boolean) : undefined,
          bio: bio || undefined
        };
      }

      await api.post('/auth/complete-profile', profileData);
      
      // Refresh user data and close modal
      onComplete();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to complete profile');
      setLoading(false);
    }
  };

  const handleRoleNext = () => {
    if (!role) {
      setError('Please select a role');
      return;
    }
    setError('');
    setStep('phone');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => {}} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-forest-600 to-nature-600 text-white rounded-t-2xl px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🌲</span>
            <div>
              <h3 className="text-xl font-bold">Complete Your Profile</h3>
              <p className="text-white/80 text-sm">{userEmail}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Progress Indicator - Show only after role selection */}
          {step !== 'role' && (
              <>
                <div className="flex items-center justify-between">
                  <div className={`flex items-center gap-2 text-green-600`}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-green-600 text-white">✓</div>
                    <span className="text-sm">Role</span>
                  </div>
                  <div className="flex-1 h-1 bg-gray-200 mx-2">
                    <div className={`h-full bg-nature-600 transition-all ${(step === 'phone' || step === 'verify') ? 'w-full' : 'w-0'}`} />
                  </div>
                  <div className={`flex items-center gap-2 ${step === 'phone' ? 'text-nature-600 font-semibold' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'phone' ? 'bg-nature-600 text-white' : 'bg-gray-200'}`}>2</div>
                    <span className="text-sm">Phone</span>
                  </div>
                  <div className="flex-1 h-1 bg-gray-200 mx-2">
                    <div className={`h-full bg-nature-600 transition-all ${step === 'verify' ? 'w-full' : 'w-0'}`} />
                  </div>
                  <div className={`flex items-center gap-2 ${step === 'verify' ? 'text-nature-600 font-semibold' : 'text-gray-400'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step === 'verify' ? 'bg-nature-600 text-white' : 'bg-gray-200'}`}>3</div>
                    <span className="text-sm">Verify</span>
                  </div>
                </div>
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
                    {error}
                  </div>
                )}
              </>

            )}
          {/* Step 1: Role Selection */}
          {step === 'role' && (
            <div className="space-y-4">
              <h4 className="font-semibold text-forest-800">How do you want to join?</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setRole('traveler')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    role === 'traveler'
                      ? 'border-nature-500 bg-nature-50'
                      : 'border-forest-200 hover:border-nature-400 hover:bg-nature-50/50'
                  }`}
                >
                  <div className="text-3xl mb-2">🎒</div>
                  <div className="font-semibold text-forest-800">Adventurer</div>
                  <div className="text-xs text-forest-600">Discover and join treks</div>
                </button>

                <button
                  onClick={() => setRole('organizer')}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    role === 'organizer'
                      ? 'border-forest-500 bg-forest-50'
                      : 'border-forest-200 hover:border-forest-400 hover:bg-forest-50/50'
                  }`}
                >
                  <div className="text-3xl mb-2">🗺️</div>
                  <div className="font-semibold text-forest-800">Organizer</div>
                  <div className="text-xs text-forest-600">Create and lead adventures</div>
                </button>
              </div>

              {/* Organizer Additional Fields */}
              {role === 'organizer' && (
                <div className="space-y-3 mt-4 p-4 bg-forest-50 rounded-xl">
                  <p className="text-sm font-semibold text-forest-800">Organizer Details (Optional)</p>
                  <textarea
                    placeholder="Brief experience (e.g., Led 20+ treks in Himalayas)"
                    value={experience}
                    onChange={(e) => setExperience(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-forest-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-400 text-sm"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min={0}
                      placeholder="Years of experience"
                      value={years}
                      onChange={(e) => setYears(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 border-2 border-forest-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-400 text-sm"
                    />
                    <input
                      placeholder="Languages"
                      value={languages}
                      onChange={(e) => setLanguages(e.target.value)}
                      className="w-full px-3 py-2 border-2 border-forest-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-400 text-sm"
                    />
                  </div>
                  <input
                    placeholder="Specialties (comma separated)"
                    value={specialties}
                    onChange={(e) => setSpecialties(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-forest-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-400 text-sm"
                  />
                  <textarea
                    placeholder="Short bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3 py-2 border-2 border-forest-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-400 text-sm"
                    rows={2}
                  />
                </div>
              )}

              <button
                onClick={handleRoleNext}
                disabled={!role}
                className={`w-full py-3 rounded-xl text-white font-semibold transition-all ${
                  role 
                    ? 'bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700' 
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Phone Number */}
          {step === 'phone' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-forest-700 mb-2">
                  📱 Phone Number
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1234567890"
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500"
                />
                <p className="text-xs text-forest-600 mt-1">Include country code (e.g., +91 for India)</p>
              </div>

              <button
                onClick={handleSendOtp}
                disabled={loading || !phone}
                className={`w-full py-3 rounded-xl text-white font-semibold transition-all ${
                  !loading && phone
                    ? 'bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {loading ? 'Sending...' : 'Send Verification Code'}
              </button>

              <button
                onClick={() => setStep('role')}
                className="w-full py-2 text-forest-600 hover:text-forest-800 font-medium text-sm"
              >
                ← Back
              </button>
            </div>
          )}

          {/* Step 3: Verify OTP */}
          {step === 'verify' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-forest-700 mb-2">
                  🔐 Verification Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-forest-600 mt-1">
                  Code sent to {phone}
                </p>
                
                {devOtp && (
                  <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-800">
                      <strong>DEV MODE:</strong> Your OTP is <span className="font-mono font-bold">{devOtp}</span>
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={handleVerifyOtp}
                disabled={loading || otp.length !== 6}
                className={`w-full py-3 rounded-xl text-white font-semibold transition-all ${
                  !loading && otp.length === 6
                    ? 'bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700'
                    : 'bg-gray-300 cursor-not-allowed'
                }`}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Verifying...
                  </span>
                ) : (
                  'Verify & Complete'
                )}
              </button>

              <button
                onClick={() => countdown === 0 ? handleSendOtp() : null}
                disabled={countdown > 0}
                className={`w-full py-2 text-sm font-medium ${
                  countdown > 0
                    ? 'text-gray-400 cursor-not-allowed'
                    : 'text-forest-600 hover:text-forest-800'
                }`}
              >
                {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompleteProfileModal;
