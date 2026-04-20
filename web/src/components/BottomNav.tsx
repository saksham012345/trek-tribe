import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { User } from '../types';

interface BottomNavProps {
  user: User | null;
}

const BottomNav: React.FC<BottomNavProps> = ({ user }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const hideOn = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
  if (hideOn.includes(location.pathname)) return null;

  const travelerNav = [
    { to: '/home', icon: 'H', label: 'Home' },
    { to: '/discover', icon: 'D', label: 'Explore' },
    { to: '/my-bookings', icon: 'B', label: 'Bookings' },
    { to: '/wishlist', icon: 'W', label: 'Saved' },
    { to: '/my-profile', icon: 'P', label: 'Profile' },
  ];

  const organizerNav = [
    { to: '/home', icon: 'H', label: 'Home' },
    { to: '/discover', icon: 'D', label: 'Explore' },
    { to: '/create-trip', icon: 'C', label: 'Create' },
    { to: '/crm', icon: 'R', label: 'CRM' },
    { to: '/my-profile', icon: 'P', label: 'Profile' },
  ];

  const adminNav = [
    { to: '/home', icon: 'H', label: 'Home' },
    { to: '/discover', icon: 'D', label: 'Trips' },
    { to: '/admin', icon: 'A', label: 'Admin' },
    { to: '/crm', icon: 'R', label: 'CRM' },
    { to: '/my-profile', icon: 'P', label: 'Profile' },
  ];

  const guestNav = [
    { to: '/discover', icon: 'D', label: 'Explore' },
    { to: '/search', icon: 'S', label: 'Search' },
    { to: '/login', icon: 'L', label: 'Login' },
    { to: '/register', icon: 'J', label: 'Join' },
  ];

  const navItems = !user
    ? guestNav
    : user.role === 'admin'
      ? adminNav
      : user.role === 'organizer'
        ? organizerNav
        : travelerNav;

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100 shadow-[0_-4px_20px_rgba(0,0,0,0.08)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {navItems.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-colors relative ${
                active ? 'text-forest-700' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-forest-600 rounded-full" />
              )}
              <span className={`text-sm font-bold leading-none mb-0.5 transition-transform ${active ? 'scale-110' : ''}`}>
                {item.icon}
              </span>
              <span className={`text-[10px] font-medium leading-none ${active ? 'text-forest-700' : 'text-gray-400'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;