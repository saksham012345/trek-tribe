import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import CompleteProfileModal from './CompleteProfileModal';
import api from '../config/api';

interface GoogleLoginButtonProps {
  onSuccess?: () => void;
  onError?: (error: string) => void;
  className?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
          prompt: () => void;
        };
      };
    };
  }
}

const GoogleLoginButton: React.FC<GoogleLoginButtonProps> = ({
  onSuccess,
  onError,
  className = ''
}) => {
  const { login } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);
  const scriptLoaded = useRef(false);
  const [gisReady, setGisReady] = useState(false);
  const [showCompleteProfile, setShowCompleteProfile] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [scriptError, setScriptError] = useState(false);

  const handleGoogleResponse = async (response: { credential: string }) => {
    setIsProcessing(true);
    try {
      const authResponse = await api.post<{
        token: string;
        user: { email: string; [key: string]: any };
        requiresProfileCompletion?: boolean;
      }>('/auth/google', {
        credential: response.credential
      });

      const { token, user, requiresProfileCompletion } = authResponse.data;
      
      // Store token
      localStorage.setItem('token', token);
      
      // Check if profile needs completion
      if (requiresProfileCompletion) {
        setUserEmail(user.email);
        setShowCompleteProfile(true);
        setIsProcessing(false);
      } else {
        // Profile is complete, proceed with normal login
        const result = await login(response.credential, 'google');
        if (result.success) {
          onSuccess?.();
        } else {
          setIsProcessing(false);
          onError?.(result.error || 'Google login failed');
        }
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      setIsProcessing(false);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || error.message || 'Google login failed';
      onError?.(errorMsg);
    }
  };

  const handleProfileComplete = async () => {
    setShowCompleteProfile(false);
    
    // Fetch updated user data
    try {
      const userResponse = await api.get<{ user?: any }>('/auth/me');
      if (userResponse.data?.user) {
        // Trigger success callback which should refresh the app
        onSuccess?.();
      }
    } catch (error) {
      console.error('Error fetching user after profile completion:', error);
      // Still trigger success, the app will handle the refresh
      onSuccess?.();
    }
  };

  const initializeGoogleSignIn = () => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      console.warn('Google Client ID not configured');
      // Surface a clear, non-blocking indicator in UI; keep login form usable
      setGisReady(false);
      return;
    }

    if (window.google && buttonRef.current) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleGoogleResponse,
        auto_select: false,
        cancel_on_tap_outside: true,
      });

      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        type: 'standard',
        text: 'signin_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        width: '100%',
      });
      setGisReady(true);
    }
  };

  const loadGoogleScript = () => {
    if (scriptLoaded.current) return;

    // Reuse existing script tag if already present
    let script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]') as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
    
    script.onload = () => {
      scriptLoaded.current = true;
      initializeGoogleSignIn();
    };

    script.onerror = () => {
      console.error('Failed to load Google Identity Services script');
      setScriptError(true);
      onError?.('Failed to load Google login. Please check your internet connection.');
    };

    return () => {
      // Do not remove the global script to avoid breaking other instances
    };
  };

  useEffect(() => {
    const cleanup = loadGoogleScript();
    return cleanup;
  }, []);

  useEffect(() => {
    if (window.google && scriptLoaded.current) {
      initializeGoogleSignIn();
    }
  }, [buttonRef.current]);

  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
  const tryPrompt = () => {
    if (!clientId) return;
    if (!window.google) return;
    try {
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleResponse });
      window.google.accounts.id.prompt();
    } catch {}
  };

  return (
    <>
      <div className={className}>
        {/* Loading overlay during processing */}
        {isProcessing && (
          <div className="relative w-full">
            <div className="w-full flex items-center justify-center gap-3 py-3 px-4 border-2 border-nature-200 rounded-xl bg-nature-50">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-nature-600 border-t-transparent"></div>
              <span className="text-nature-700 font-medium">Signing in with Google...</span>
            </div>
          </div>
        )}
        
        {/* Google button container - hidden when processing */}
        {!isProcessing && (
          <>
            <div
              ref={buttonRef}
              className="w-full flex items-center justify-center min-h-[42px]"
            />
            {!gisReady && clientId && !scriptError && (
              <button
                type="button"
                onClick={tryPrompt}
                className="w-full flex items-center justify-center gap-2 border-2 border-forest-300 rounded-xl py-3 px-4 text-forest-700 hover:bg-forest-50 hover:border-forest-400 transition-all duration-200 font-medium"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>
            )}
            {scriptError && (
              <div className="w-full mt-2">
                <button
                  type="button"
                  disabled
                  className="w-full border-2 border-red-300 bg-red-50 text-red-700 rounded-xl py-3 px-4 cursor-not-allowed font-medium"
                >
                  Google Sign-In unavailable
                </button>
                <div className="text-xs text-red-600 mt-2 flex items-start gap-1">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Failed to load Google authentication. Please check your internet connection and try refreshing the page.</span>
                </div>
              </div>
            )}
            {!clientId && (
              <div className="w-full mt-2">
                <button
                  type="button"
                  disabled
                  title="Google Sign-In is not configured"
                  className="w-full border-2 border-amber-300 bg-amber-50 text-amber-700 rounded-xl py-3 px-4 cursor-not-allowed font-medium"
                >
                  Continue with Google (not configured)
                </button>
                <div className="text-xs text-amber-700 mt-2 flex items-start gap-1">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Google Sign-In is not configured. Contact support or use email login.</span>
                </div>
              </div>
            )}
            <noscript>
              <div className="text-center text-gray-500 text-sm mt-2">
                JavaScript is required for Google Sign-In
              </div>
            </noscript>
          </>
        )}
      </div>
      
      {/* Profile Completion Modal */}
      <CompleteProfileModal
        open={showCompleteProfile}
        onComplete={handleProfileComplete}
        userEmail={userEmail}
      />
    </>
  );
};

export default GoogleLoginButton;