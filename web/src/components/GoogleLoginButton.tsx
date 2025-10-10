import React, { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

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

  const handleGoogleResponse = async (response: { credential: string }) => {
    try {
      const result = await login(response.credential, 'google');
      if (result.success) {
        onSuccess?.();
      } else {
        onError?.(result.error || 'Google login failed');
      }
    } catch (error: any) {
      console.error('Google login error:', error);
      onError?.(error.message || 'Google login failed');
    }
  };

  const initializeGoogleSignIn = () => {
    const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;
    
    if (!clientId) {
      console.error('Google Client ID not configured');
      onError?.('Google login is not configured');
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
    }
  };

  const loadGoogleScript = () => {
    if (scriptLoaded.current) return;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    
    script.onload = () => {
      scriptLoaded.current = true;
      initializeGoogleSignIn();
    };

    script.onerror = () => {
      console.error('Failed to load Google Identity Services script');
      onError?.('Failed to load Google login');
    };

    document.head.appendChild(script);

    return () => {
      document.head.removeChild(script);
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

  return (
    <div className={className}>
      <div
        ref={buttonRef}
        className="w-full flex items-center justify-center"
      />
      <noscript>
        <div className="text-center text-gray-500 text-sm mt-2">
          JavaScript is required for Google Sign-In
        </div>
      </noscript>
    </div>
  );
};

export default GoogleLoginButton;