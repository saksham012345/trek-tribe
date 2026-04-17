import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { User } from '../types';
import NotificationCenter from './NotificationCenter';
import { getSafeUrl } from '../utils/url';

interface HeaderProps {
  user: User | null;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const isActive = (path: string) => location.pathname === path;

  const NavLink = ({ to, icon, children, className = '' }: { to: string; icon?: string; children?: React.ReactNode; className?: string }) => (
    <Link
      to={to}
      className={`
        relative px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 group
        ${isActive(to)
          ? 'bg-forest-100 text-forest-700 shadow-sm ring-1 ring-forest-200'
          : 'text-forest-600 hover:text-forest-900 hover:bg-forest-50'
        }
        ${className}
      `}
    >
      {icon && <span className="text-lg group-hover:scale-110 transition-transform duration-300">{icon}</span>}
      {children}
    </Link>
  );

  return (
    <>
      <header
        className={`
          fixed w-full top-0 z-50 transition-all duration-500 border-b
          ${scrolled
            ? 'bg-white/80 backdrop-blur-xl border-forest-100 shadow-sm py-2'
            : 'bg-white/60 backdrop-blur-md border-transparent py-4'
          }
        `}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-3 group" onClick={closeMobileMenu}>
                <div className="relative w-10 h-10 flex items-center justify-center">
                  <div className="absolute inset-0 bg-gradient-to-tr from-forest-500 to-nature-400 rounded-xl rotate-3 group-hover:rotate-6 transition-transform duration-300 opacity-20"></div>
                  <img
                    src="/logo.svg?v=3"
                    alt="TrekTribe"
                    className="w-full h-full object-contain relative z-10 drop-shadow-sm group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                    }}
                  />
                </div>
                <span className="text-lg md:text-xl font-bold bg-gradient-to-r from-forest-900 to-forest-700 bg-clip-text text-transparent tracking-tight">
                  TrekTribe
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink to="/trips" icon="🌿">Discover</NavLink>
              <NavLink to="/search" icon="🔍">Organizers</NavLink>
              <NavLink to="/ai-showcase" icon="🤖">AI Compass</NavLink>

              {user?.role === 'organizer' && (
                <>
                  <div className="w-px h-6 bg-forest-200 mx-2"></div>
                  <NavLink to="/create-trip" icon="➕">Create</NavLink>
                  <NavLink to="/crm" icon="📊">CRM</NavLink>
                </>
              )}

              {user?.role === 'admin' && (
                <NavLink to="/admin" icon="🛠️" className="text-purple-600">Admin</NavLink>
              )}

              {user?.role === 'agent' && (
                <NavLink to="/agent" icon="🕵️" className="text-blue-600">Agent</NavLink>
              )}
            </nav>

            {/* User Actions */}
            <div className="flex items-center gap-3">
              {user ? (
                <div className="hidden md:flex items-center gap-3 pl-2">
                  <NotificationCenter />

                  <Link
                    to="/wishlist"
                    className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-red-50 text-forest-400 hover:text-red-500 transition-colors"
                    title="Wishlist"
                  >
                    ❤️
                  </Link>

                  <div className="w-px h-6 bg-forest-200 mx-1"></div>

                  <Link
                    to="/my-profile"
                    className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-forest-50 transition-colors group"
                  >
                    <span className="text-sm font-medium text-forest-700 group-hover:text-forest-900">
                      {user.name.split(' ')[0]}
                    </span>
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-forest-500 to-nature-400 p-[2px]">
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                        {user.profilePhoto ? (
                          <img src={getSafeUrl(user.profilePhoto) || ''} alt={user.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-forest-600">
                            {user.name.charAt(0)}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-3">
                  <Link
                    to="/login"
                    className="px-5 py-2.5 rounded-full text-sm font-medium text-forest-600 hover:text-forest-900 transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/register"
                    className="px-5 py-2.5 rounded-full text-sm font-medium text-white bg-forest-900 hover:bg-forest-800 shadow-lg shadow-forest-900/20 hover:shadow-xl hover:shadow-forest-900/30 transition-all transform hover:-translate-y-0.5"
                  >
                    Join the Tribe
                  </Link>
                </div>
              )}

              {/* Mobile: show avatar + notifications */}
              {user && (
                <div className="flex md:hidden items-center gap-2">
                  <NotificationCenter />
                  <Link to="/my-profile" className="w-9 h-9 rounded-full bg-gradient-to-tr from-forest-500 to-nature-400 p-[2px]">
                    <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                      {user.profilePhoto ? (
                        <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-xs font-bold text-forest-600">{user.name.charAt(0)}</span>
                      )}
                    </div>
                  </Link>
                </div>
              )}

              {/* Mobile Menu Button — hidden on mobile since BottomNav handles navigation */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="hidden p-2 rounded-xl text-forest-600 hover:bg-forest-50 transition-colors"
                aria-label="Menu"
              >
                <div className="w-6 h-5 flex flex-col justify-between">
                  <span className={`w-full h-0.5 bg-current rounded-full transition-all duration-300 ${isMobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`} />
                  <span className={`w-full h-0.5 bg-current rounded-full transition-all duration-300 ${isMobileMenuOpen ? 'opacity-0' : ''}`} />
                  <span className={`w-full h-0.5 bg-current rounded-full transition-all duration-300 ${isMobileMenuOpen ? '-rotate-45 -translate-y-2.5' : ''}`} />
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={`
          fixed inset-0 z-40 bg-forest-900/20 backdrop-blur-sm transition-opacity duration-300 md:hidden
          ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}
        `}
        onClick={closeMobileMenu}
      />

      {/* Mobile Menu Panel */}
      <div
        className={`
          fixed top-0 right-0 z-50 w-[80%] max-w-sm h-full bg-white shadow-2xl transition-transform duration-300 ease-out transform md:hidden
          ${isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full pt-20 pb-6 px-6 overflow-y-auto">
          {user ? (
            <div className="mb-8 p-4 bg-forest-50 rounded-2xl flex items-center gap-4">
              <div className="w-12 h-12 rounded-full overflow-hidden bg-white border-2 border-white shadow-sm">
                {user.profilePhoto ? (
                  <img src={user.profilePhoto} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-forest-600 font-bold text-lg">
                    {user.name.charAt(0)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-forest-900 truncate">{user.name}</h3>
                <p className="text-xs text-forest-500 truncate">{user.email}</p>
              </div>
            </div>
          ) : (
            <div className="mb-8 flex flex-col gap-3">
              <Link
                to="/register"
                onClick={closeMobileMenu}
                className="w-full py-3 rounded-xl bg-forest-900 text-white font-bold text-center shadow-lg shadow-forest-900/20"
              >
                Join the Tribe
              </Link>
              <Link
                to="/login"
                onClick={closeMobileMenu}
                className="w-full py-3 rounded-xl bg-forest-50 text-forest-900 font-bold text-center"
              >
                Log In
              </Link>
            </div>
          )}

          <div className="space-y-1">
            <h4 className="text-xs font-bold text-forest-400 uppercase tracking-wider mb-2 px-4">Menu</h4>
            {[
              { to: '/trips', icon: '🌿', label: 'Discover' },
              { to: '/search', icon: '🔍', label: 'Organizers' },
              { to: '/ai-showcase', icon: '🤖', label: 'AI Compass' },
            ].map(link => (
              <Link
                key={link.to}
                to={link.to}
                onClick={closeMobileMenu}
                className={`
                  flex items-center gap-4 px-4 py-3 rounded-xl transition-colors
                  ${isActive(link.to) ? 'bg-forest-100 text-forest-900 font-bold' : 'text-forest-600 hover:bg-forest-50'}
                `}
              >
                <span className="text-xl">{link.icon}</span>
                {link.label}
              </Link>
            ))}

            {user?.role === 'organizer' && (
              <>
                <div className="my-4 border-t border-forest-100"></div>
                <h4 className="text-xs font-bold text-forest-400 uppercase tracking-wider mb-2 px-4">Organizer</h4>
                <Link to="/create-trip" onClick={closeMobileMenu} className="flex items-center gap-4 px-4 py-3 rounded-xl text-forest-600 hover:bg-forest-50">
                  <span className="text-xl">➕</span> Create Trip
                </Link>
                <Link to="/crm" onClick={closeMobileMenu} className="flex items-center gap-4 px-4 py-3 rounded-xl text-forest-600 hover:bg-forest-50">
                  <span className="text-xl">📊</span> CRM
                </Link>
              </>
            )}

            {user?.role === 'agent' && (
              <>
                <div className="my-4 border-t border-forest-100"></div>
                <h4 className="text-xs font-bold text-forest-400 uppercase tracking-wider mb-2 px-4">Agent</h4>
                <Link to="/agent" onClick={closeMobileMenu} className="flex items-center gap-4 px-4 py-3 rounded-xl text-forest-600 hover:bg-forest-50">
                  <span className="text-xl">🕵️</span> Dashboard
                </Link>
              </>
            )}

            {user && (
              <>
                <div className="my-4 border-t border-forest-100"></div>
                <h4 className="text-xs font-bold text-forest-400 uppercase tracking-wider mb-2 px-4">Account</h4>
                <Link to="/my-profile" onClick={closeMobileMenu} className="flex items-center gap-4 px-4 py-3 rounded-xl text-forest-600 hover:bg-forest-50">
                  <span className="text-xl">👤</span> Profile
                </Link>
                <Link to="/my-bookings" onClick={closeMobileMenu} className="flex items-center gap-4 px-4 py-3 rounded-xl text-forest-600 hover:bg-forest-50">
                  <span className="text-xl">📋</span> Bookings
                </Link>
                <Link to="/wishlist" onClick={closeMobileMenu} className="flex items-center gap-4 px-4 py-3 rounded-xl text-forest-600 hover:bg-forest-50">
                  <span className="text-xl">❤️</span> Wishlist
                </Link>
                <button
                  onClick={() => { onLogout(); closeMobileMenu(); }}
                  className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 text-left mt-2"
                >
                  <span className="text-xl">🚪</span> Logout
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default Header;
