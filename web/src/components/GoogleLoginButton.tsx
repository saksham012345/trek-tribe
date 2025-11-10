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

  const handleGoogleResponse = async (response: { credential: string }) => {
    try {
      const authResponse = await api.post('/auth/google', {
        credential: response.credential
      });

      const { token, user, requiresProfileCompletion } = authResponse.data;
      
      // Store token
      localStorage.setItem('token', token);
      
      // Check if profile needs completion
      if (requiresProfileCompletion) {
        setUserEmail(user.email);
        setShowCompleteProfile(true);
      } else {
        // Profile is complete, proceed with normal login
        const result = await login(response.credential, 'google');
        if (result.success) {
          onSuccess?.();
        } else {
          onError?.(result.error || 'Google login failed');
        }
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      onError?.(error.message || 'Google login failed');
    }
  };

  const handleProfileComplete = async () => {
    setShowCompleteProfile(false);
    
    // Fetch updated user data
    try {
      const userResponse = await api.get('/auth/me');
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
      onError?.('Failed to load Google login');
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
        <div
          ref={buttonRef}
          className="w-full flex items-center justify-center min-h-[42px]"
        />
        {!gisReady && clientId && (
          <button
            type="button"
            onClick={tryPrompt}
            className="w-full mt-2 border border-forest-300 rounded-md py-2 text-forest-700 hover:bg-forest-50"
          >
            Continue with Google
          </button>
        )}
        {!clientId && (
          <div className="w-full mt-2">
            <button
              type="button"
              disabled
              title="Google Sign-In is not configured"
              className="w-full border border-red-200 bg-red-50 text-red-600 rounded-md py-2 cursor-not-allowed"
            >
              Continue with Google (not configured)
            </button>
            <div className="text-xs text-red-600 mt-1">
              Set REACT_APP_GOOGLE_CLIENT_ID in your environment to enable Google login.
            </div>
          </div>
        )}
        <noscript>
          <div className="text-center text-gray-500 text-sm mt-2">
            JavaScript is required for Google Sign-In
          </div>
        </noscript>
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