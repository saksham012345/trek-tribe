import React, { useState, useEffect } from 'react';
import api from '../config/api';

interface PhoneVerificationModalProps {
  open: boolean;
  phone: string;
  userId: string;
  onVerified: () => void;
  onClose: () => void;
  initialDevOtp?: string;
}

const PhoneVerificationModal: React.FC<PhoneVerificationModalProps> = ({
  open,
  phone,
  userId,
  onVerified,
  onClose,
  initialDevOtp
}) => {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState(initialDevOtp || '');

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!open) return null;

  const handleVerify = async () => {
    if (!otp || otp.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/verify-registration-phone', {
        userId,
        phone,
        otp
      });

      // Phone verified successfully
      onVerified();
    } catch (error: any) {
      setError(error.response?.data?.error || 'Invalid verification code');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/resend-registration-otp', {
        userId,
        phone
      });

      setCountdown(60);
      setError('');
      
      // Show dev OTP if available
      if (response.data.otp) {
        setDevOtp(response.data.otp);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Failed to resend code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-forest-600 to-nature-600 text-white rounded-t-2xl px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <h3 className="text-xl font-bold">Verify Your Phone</h3>
              <p className="text-white/80 text-sm">Enter the code sent to {phone}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">
              {error}
            </div>
          )}

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
              autoFocus
            />
            <p className="text-xs text-forest-600 mt-2">
              Check your phone for the verification code
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
            onClick={handleVerify}
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
              'Verify Phone Number'
            )}
          </button>

          <div className="text-center">
            <button
              onClick={handleResend}
              disabled={countdown > 0 || loading}
              className={`text-sm font-medium ${
                countdown > 0 || loading
                  ? 'text-gray-400 cursor-not-allowed'
                  : 'text-forest-600 hover:text-forest-800'
              }`}
            >
              {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend Code'}
            </button>
          </div>

          <div className="text-center pt-2 border-t border-forest-100">
            <button
              onClick={onClose}
              className="text-sm text-forest-600 hover:text-forest-800"
            >
              Cancel Registration
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PhoneVerificationModal;
