import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

interface AuthCallbackProps {
  onLogin: (token: string, userData: any) => void;
}

const AuthCallback: React.FC<AuthCallbackProps> = ({ onLogin }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleAuthCallback = () => {
      const token = searchParams.get('token');
      const userParam = searchParams.get('user');
      const error = searchParams.get('message');

      if (error) {
        setStatus('error');
        setMessage(decodeURIComponent(error));
        setTimeout(() => {
          navigate('/login');
        }, 3000);
        return;
      }

      if (token && userParam) {
        try {
          const userData = JSON.parse(decodeURIComponent(userParam));
          setStatus('success');
          setMessage('Authentication successful! Redirecting...');
          
          // Call the login handler
          onLogin(token, userData);
          
          setTimeout(() => {
            navigate('/');
          }, 2000);
        } catch (error) {
          console.error('Error parsing user data:', error);
          setStatus('error');
          setMessage('Authentication data invalid. Please try again.');
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        }
      } else {
        setStatus('error');
        setMessage('Authentication failed. No valid data received.');
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      }
    };

    handleAuthCallback();
  }, [searchParams, navigate, onLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-50 to-nature-50">
      <div className="max-w-md w-full space-y-8 text-center">
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-forest-200">
          {status === 'loading' && (
            <>
              <div className="mx-auto h-16 w-16 bg-gradient-to-br from-forest-600 to-nature-600 rounded-2xl flex items-center justify-center shadow-lg mb-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
              </div>
              <h2 className="text-2xl font-bold text-forest-800 mb-4">
                Completing Authentication...
              </h2>
              <p className="text-forest-600">
                Please wait while we process your authentication.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="mx-auto h-16 w-16 bg-gradient-to-br from-green-600 to-green-700 rounded-2xl flex items-center justify-center shadow-lg mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-green-800 mb-4">
                Authentication Successful!
              </h2>
              <p className="text-green-600">
                {message}
              </p>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="mx-auto h-16 w-16 bg-gradient-to-br from-red-600 to-red-700 rounded-2xl flex items-center justify-center shadow-lg mb-6">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-red-800 mb-4">
                Authentication Failed
              </h2>
              <p className="text-red-600 mb-6">
                {message}
              </p>
              <p className="text-sm text-forest-600">
                Redirecting to login page...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthCallback;