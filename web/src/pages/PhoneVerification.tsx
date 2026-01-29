import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { useToast, ToastContainer } from '../components/Toast';

const PhoneVerification: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, refreshUser } = useAuth();
  const { toasts, success, error: showErrorToast, removeToast } = useToast();

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [devOtp, setDevOtp] = useState('');

  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Check if already verified
  useEffect(() => {
    if (user?.phoneVerified) {
      // Already verified, redirect based on state or role
      const from = (location.state as any)?.from || getDashboardRoute();
      navigate(from, { replace: true });
    }
  }, [user, navigate, location]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const getDashboardRoute = () => {
    if (!user) return '/';
    switch (user.role) {
      case 'organizer': return '/organizer-dashboard';
      case 'agent': return '/agent-dashboard';
      case 'admin': return '/admin-dashboard';
      default: return '/';
    }
  };

  const validatePhone = (phoneNumber: string): boolean => {
    // Match format: optional +, followed by 1-9, then 1-14 digits
    const phoneRegex = /^[+]?[1-9]\d{1,14}$/;
    return phoneRegex.test(phoneNumber.replace(/\s/g, ''));
  };

  const handleSendOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const cleanPhone = phone.replace(/\s/g, '');

    if (!validatePhone(cleanPhone)) {
      setError('Please enter a valid phone number (e.g., +919876543210)');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/verify-phone/send-otp', { phone: cleanPhone });

      // Store dev OTP if available
      if (response.data.otp) {
        setDevOtp(response.data.otp);
        console.log('DEV OTP:', response.data.otp);
      }

      setStep('otp');
      setCountdown(60);
      success('OTP sent to your phone!');

      // Focus first OTP input
      setTimeout(() => otpInputRefs.current[0]?.focus(), 100);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Failed to send OTP';
      setError(errorMsg);
      showErrorToast(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    if (newOtp.every(digit => digit !== '') && newOtp.join('').length === 6) {
      handleVerifyOTP(newOtp.join(''));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      // Move to previous input on backspace if current is empty
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);

    if (/^\d+$/.test(pastedData)) {
      const newOtp = pastedData.split('').concat(Array(6).fill('')).slice(0, 6);
      setOtp(newOtp);

      // Focus last filled input or first empty
      const focusIndex = Math.min(pastedData.length, 5);
      otpInputRefs.current[focusIndex]?.focus();

      // Auto-submit if 6 digits pasted
      if (pastedData.length === 6) {
        handleVerifyOTP(pastedData);
      }
    }
  };

  const handleVerifyOTP = async (otpValue?: string) => {
    const otpCode = otpValue || otp.join('');

    if (otpCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await api.post('/auth/verify-phone/verify-otp', {
        phone: phone.replace(/\s/g, ''),
        otp: otpCode
      });

      success('Phone verified successfully!');

      // Refresh user data
      if (refreshUser) {
        await refreshUser();
      }

      // Redirect based on next required step
      setTimeout(() => {
        const nextStep = (location.state as any)?.nextStep;

        if (nextStep === 'auto-pay') {
          navigate('/setup-auto-pay', { replace: true });
        } else if (nextStep === 'complete-profile') {
          navigate('/complete-profile', { replace: true });
        } else {
          navigate(getDashboardRoute(), { replace: true });
        }
      }, 1000);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || 'Invalid OTP';
      setError(errorMsg);
      showErrorToast(errorMsg);

      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;

    setOtp(['', '', '', '', '', '']);
    await handleSendOTP();
  };

  const handleChangePhone = () => {
    setStep('phone');
    setOtp(['', '', '', '', '', '']);
    setError('');
  };

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-50 via-nature-50 to-forest-100 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto h-20 w-20 bg-gradient-to-br from-forest-600 to-nature-600 rounded-2xl flex items-center justify-center shadow-lg">
              <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-forest-900">
              Verify Your Phone
            </h2>
            <p className="mt-2 text-sm text-forest-600">
              {step === 'phone'
                ? 'Enter your phone number to receive a verification code'
                : 'Enter the 6-digit code sent to your phone'
              }
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
            {/* Dev OTP Display (only in development) */}
            {devOtp && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                <p className="text-xs text-yellow-800 font-medium">DEV MODE - OTP:</p>
                <p className="text-2xl font-bold text-yellow-900 mt-1">{devOtp}</p>
              </div>
            )}

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded flex items-start gap-3">
                <svg className="w-5 h-5 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{error}</span>
              </div>
            )}

            {step === 'phone' ? (
              /* Phone Number Step */
              <form onSubmit={handleSendOTP} className="space-y-6">
                <div>
                  <label htmlFor="phone" className="block text-sm font-semibold text-forest-700 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-forest-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      placeholder="+919876543210"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setError('');
                      }}
                      className="w-full pl-12 pr-4 py-3.5 border-2 border-forest-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition-all"
                      disabled={loading}
                      required
                    />
                  </div>
                  <p className="mt-2 text-xs text-forest-500">
                    Format: +[country code][number] (e.g., +919876543210)
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading || !phone}
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
              </form>
            ) : (
              /* OTP Verification Step */
              <div className="space-y-6">
                <div className="bg-forest-50 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-forest-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    <span className="text-sm font-medium text-forest-700">{phone}</span>
                  </div>
                  <button
                    onClick={handleChangePhone}
                    className="text-sm text-nature-600 hover:text-nature-700 font-medium"
                  >
                    Change
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-forest-700 mb-3 text-center">
                    Enter Verification Code
                  </label>
                  <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => { if (el) otpInputRefs.current[index] = el; }}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(index, e)}
                        className="w-12 h-14 text-center text-2xl font-bold border-2 border-forest-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-forest-500 focus:border-transparent transition-all"
                        disabled={loading}
                      />
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleVerifyOTP()}
                  disabled={loading || otp.some(d => !d)}
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
                    'Verify Code'
                  )}
                </button>

                <div className="text-center">
                  <button
                    onClick={handleResendOTP}
                    disabled={countdown > 0 || loading}
                    className="text-sm text-nature-600 hover:text-nature-700 font-medium disabled:text-forest-400 disabled:cursor-not-allowed"
                  >
                    {countdown > 0 ? (
                      `Resend code in ${countdown}s`
                    ) : (
                      'Resend verification code'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Help Text */}
          <div className="text-center">
            <p className="text-xs text-forest-500">
              Having trouble?{' '}
              <a href="/support" className="text-nature-600 hover:text-nature-700 font-medium">
                Contact Support
              </a>
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default PhoneVerification;
