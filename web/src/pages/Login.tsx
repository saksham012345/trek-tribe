import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import GoogleLoginButton from '../components/GoogleLoginButton';

interface LoginProps {
  onLogin: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Do NOT clear error on typing; persist until next submit attempt
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Clear the previous error only when the user presses the button again
    setError('');

    try {
      const result = await onLogin(formData.email, formData.password);
      if (result.success) {
        // Clear error on successful login
        setError('');
        // Get the intended destination or default to home
        const from = (location.state as any)?.from?.pathname || '/';
        navigate(from, { replace: true });
      } else if (result.error) {
        setError(result.error);
      }
    } catch (error: any) {
      setError(error.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-forest-50 to-nature-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6 sm:space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 sm:h-16 sm:w-16 bg-gradient-to-br from-forest-600 to-nature-600 rounded-2xl flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl sm:text-2xl">🌲</span>
          </div>
          <h2 className="mt-4 sm:mt-6 text-center text-2xl sm:text-3xl font-extrabold text-forest-800">
            Welcome Back,
            <br/>
            <span className="text-nature-600">Adventurer!</span>
          </h2>
          <p className="mt-2 text-center text-sm text-forest-600">
            New to the tribe?{' '}
            <Link to="/register" className="font-medium text-nature-600 hover:text-forest-700 transition-colors">
              Join our community
            </Link>
          </p>
        </div>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl p-6 sm:p-8 border border-forest-200">
          {/* Google Sign-In */}
          <div className="space-y-3">
            <GoogleLoginButton 
              className="w-full"
              onError={(msg) => {
                // Persist error until the next login attempt
                setError(msg || 'Google login failed');
              }}
              onSuccess={() => {
                // Clear error and navigate like normal login
                setError('');
                const from = (location.state as any)?.from?.pathname || '/home';
                navigate(from, { replace: true });
              }}
            />
            <div className="flex items-center gap-2">
              <div className="h-px bg-forest-200 flex-1" />
              <span className="text-forest-500 text-sm">or</span>
              <div className="h-px bg-forest-200 flex-1" />
            </div>
          </div>

          <form className="space-y-4 sm:space-y-6 mt-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2">
                <span className="text-xl">⚠️</span>
                <span className="text-sm">{error}</span>
              </div>
            )}
            
            <div className="space-y-6">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  📧 Email address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-forest-700 mb-2 flex items-center gap-2">
                  🔐 Password
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border-2 border-forest-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-nature-500 focus:border-nature-500 transition-all duration-300 bg-forest-50/50"
                  placeholder="Enter your password"
                />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <Link to="/forgot-password" className="font-medium text-nature-600 hover:text-forest-700 transition-colors">
                  Forgot your password?
                </Link>
              </div>
            </div>

            <div className="pt-2 sm:pt-4">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 sm:py-4 px-4 sm:px-6 border border-transparent text-base sm:text-lg font-bold rounded-xl text-white bg-gradient-to-r from-forest-600 to-nature-600 hover:from-forest-700 hover:to-nature-700 focus:outline-none focus:ring-4 focus:ring-forest-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Entering the wilderness...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    🏕️ Enter the Tribe
                    <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
