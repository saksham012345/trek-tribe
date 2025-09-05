import React from 'react';
import { Link } from 'react-router-dom';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'traveler' | 'organizer' | 'admin';
}

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  return (
    <header className="bg-white/95 backdrop-blur-md shadow-lg border-b border-forest-200 fixed w-full top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link to="/" className="flex items-center group">
              <div className="w-10 h-10 bg-gradient-to-br from-forest-600 to-nature-600 rounded-xl flex items-center justify-center group-hover:from-forest-700 group-hover:to-nature-700 transition-all duration-300 transform group-hover:scale-105">
                <span className="text-white font-bold text-lg">🌲</span>
              </div>
              <span className="ml-3 text-xl font-bold bg-gradient-to-r from-forest-800 to-nature-600 bg-clip-text text-transparent">Trekk Tribe</span>
            </Link>
          </div>

          <nav className="hidden md:flex space-x-2">
            <Link 
              to="/trips" 
              className="text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2"
            >
              🌿 Discover Adventures
            </Link>
            {user?.role === 'organizer' && (
              <Link 
                to="/create-trip" 
                className="text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2"
              >
                ➕ Create Adventure
              </Link>
            )}
          </nav>

          <div className="flex items-center space-x-3">
            {user ? (
              <div className="flex items-center space-x-3">
                <Link 
                  to="/profile" 
                  className="text-forest-700 hover:text-nature-600 hover:bg-forest-50 px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2"
                >
                  🏕️ {user.name}
                </Link>
                <button
                  onClick={onLogout}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 transform hover:scale-105"
                >
                  🚪 Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
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
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
