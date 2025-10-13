import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User } from '../types';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };


  return (
    <header className="bg-white/95 backdrop-blur-md shadow-lg border-b border-forest-200 fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center group" onClick={closeMobileMenu}>
              <div className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center group-hover:scale-105 transition-all duration-300">
                <img 
                  src="/logo.svg?v=3" 
                  alt="TrekTribe Logo" 
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                  }}
                />
              </div>
              <span className="ml-2 sm:ml-3 text-lg sm:text-xl font-bold bg-gradient-to-r from-forest-800 to-nature-600 bg-clip-text text-transparent">TrekTribe</span>
            </Link>
          </div>


          <nav className="hidden md:flex space-x-2">
            <Link 
              to="/trips" 
              className="text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2"
            >
              🌿 Discover Adventures
            </Link>
            <Link 
              to="/search" 
              className="text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2"
            >
              🔍 Find Organizers
            </Link>
            <Link 
              to="/ai-showcase" 
              className="text-purple-700 hover:text-purple-600 hover:bg-purple-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 border border-purple-200"
            >
              🤖 AI Features
            </Link>
            {user?.role === 'organizer' && (
              <Link 
                to="/create-trip" 
                className="text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2"
              >
                ➕ Create Adventure
              </Link>
            )}
            {user?.role === 'admin' && (
              <Link 
                to="/admin" 
                className="text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2"
              >
                🛠️ Admin Dashboard
              </Link>
            )}
            {(user?.role === 'agent' || user?.role === 'admin') && (
              <Link 
                to="/agent" 
                className="text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2"
              >
                🎧 Agent Portal
              </Link>
            )}
          </nav>

          <div className="flex items-center space-x-2">
            {/* Desktop user menu */}
            {user ? (
              <div className="hidden md:flex items-center space-x-3">
                <Link 
                  to="/my-bookings" 
                  className="text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2"
                >
                  📋 My Bookings
                </Link>
                <Link 
                  to="/my-profile" 
                  className="text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2"
                >
                  👤 {user.name}
                </Link>
                <button
                  onClick={onLogout}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105"
                >
                  🚪 Logout
                </button>
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-3">
                <Link 
                  to="/login" 
                  className="text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300"
                >
                  🔑 Login
                </Link>
                <Link 
                  to="/register" 
                  className="bg-gradient-to-r from-nature-600 to-forest-600 hover:from-nature-700 hover:to-forest-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105 shadow-lg"
                >
                  🌱 Join Tribe
                </Link>
              </div>
            )}

            {/* Mobile menu button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden p-2 rounded-lg text-forest-700 hover:bg-forest-50 focus:outline-none focus:ring-2 focus:ring-nature-500 transition-colors"
              aria-label="Toggle mobile menu"
            >
              <svg 
                className="w-6 h-6" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>
        
        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-md border-t border-forest-200">
            <div className="px-4 py-4 space-y-2">
              {/* Navigation Links */}
              <Link 
                to="/trips" 
                onClick={closeMobileMenu}
                className="block text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-3 rounded-xl text-base font-medium transition-all duration-300"
              >
                🌿 Discover Adventures
              </Link>
              <Link 
                to="/search" 
                onClick={closeMobileMenu}
                className="block text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-3 rounded-xl text-base font-medium transition-all duration-300"
              >
                🔍 Find Organizers
              </Link>
              <Link 
                to="/ai-showcase" 
                onClick={closeMobileMenu}
                className="block text-purple-700 hover:text-purple-600 hover:bg-purple-50 px-4 py-3 rounded-xl text-base font-medium transition-all duration-300 border border-purple-200"
              >
                🤖 AI Features
              </Link>
              
              {/* Role-based links */}
              {user?.role === 'organizer' && (
                <Link 
                  to="/create-trip" 
                  onClick={closeMobileMenu}
                  className="block text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-3 rounded-xl text-base font-medium transition-all duration-300"
                >
                  ➕ Create Adventure
                </Link>
              )}
              {user?.role === 'admin' && (
                <Link 
                  to="/admin" 
                  onClick={closeMobileMenu}
                  className="block text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-3 rounded-xl text-base font-medium transition-all duration-300"
                >
                  🔧️ Admin Dashboard
                </Link>
              )}
              {(user?.role === 'agent' || user?.role === 'admin') && (
                <Link 
                  to="/agent" 
                  onClick={closeMobileMenu}
                  className="block text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-3 rounded-xl text-base font-medium transition-all duration-300"
                >
                  🎧 Agent Portal
                </Link>
              )}
              
              {/* User Authentication */}
              <div className="border-t border-forest-100 pt-4 mt-4">
                {user ? (
                  <div className="space-y-2">
                    <Link 
                      to="/my-bookings" 
                      onClick={closeMobileMenu}
                      className="block text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-3 rounded-xl text-base font-medium transition-all duration-300"
                    >
                      📋 My Bookings
                    </Link>
                    <Link 
                      to="/my-profile" 
                      onClick={closeMobileMenu}
                      className="block text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-3 rounded-xl text-base font-medium transition-all duration-300"
                    >
                      👤 {user.name}
                    </Link>
                    <button
                      onClick={() => { onLogout(); closeMobileMenu(); }}
                      className="w-full text-left bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-3 rounded-xl text-base font-medium transition-all duration-300"
                    >
                      🚪 Logout
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Link 
                      to="/login" 
                      onClick={closeMobileMenu}
                      className="block text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-3 rounded-xl text-base font-medium transition-all duration-300"
                    >
                      🔑 Login
                    </Link>
                    <Link 
                      to="/register" 
                      onClick={closeMobileMenu}
                      className="block bg-gradient-to-r from-nature-600 to-forest-600 hover:from-nature-700 hover:to-forest-700 text-white px-4 py-3 rounded-xl text-base font-medium transition-all duration-300 text-center"
                    >
                      🌱 Join Tribe
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
