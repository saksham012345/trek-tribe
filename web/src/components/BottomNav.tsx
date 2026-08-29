import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home as HomeIcon, Compass, Ticket, Heart, UserCircle, PlusCircle, LayoutDashboard, Shield, Users, LogIn, UserPlus } from 'lucide-react';
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
    { to: '/home', icon: HomeIcon, label: 'Home' },
    { to: '/discover', icon: Compass, label: 'Explore' },
    { to: '/my-bookings', icon: Ticket, label: 'Bookings' },
    { to: '/wishlist', icon: Heart, label: 'Saved' },
    { to: '/my-profile', icon: UserCircle, label: 'Profile' },
  ];

  const organizerNav = [
    { to: '/home', icon: HomeIcon, label: 'Home' },
    { to: '/discover', icon: Compass, label: 'Explore' },
    { to: '/create-trip', icon: PlusCircle, label: 'Create' },
    { to: '/crm', icon: LayoutDashboard, label: 'CRM' },
    { to: '/my-profile', icon: UserCircle, label: 'Profile' },
  ];

  const adminNav = [
    { to: '/home', icon: HomeIcon, label: 'Home' },
    { to: '/discover', icon: Compass, label: 'Trips' },
    { to: '/admin', icon: Shield, label: 'Admin' },
    { to: '/crm', icon: LayoutDashboard, label: 'CRM' },
    { to: '/my-profile', icon: UserCircle, label: 'Profile' },
  ];

  const guestNav = [
    { to: '/discover', icon: Compass, label: 'Explore' },
    { to: '/search', icon: Users, label: 'Search' },
    { to: '/login', icon: LogIn, label: 'Login' },
    { to: '/register', icon: UserPlus, label: 'Join' },
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
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-glass saturate-150 border-t border-white/50 shadow-[0_-8px_32px_rgba(15,23,42,0.10)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex items-stretch">
        {navItems.map((item) => {
          const active = isActive(item.to);
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`flex-1 flex flex-col items-center justify-center py-2 min-h-[56px] transition-all duration-300 ease-spring relative ${
                active ? 'text-forest-700' : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              {active && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-forest-600 rounded-full" />
              )}
              <item.icon
                size={22}
                strokeWidth={active ? 2.25 : 2}
                fill={active ? 'currentColor' : 'none'}
                fillOpacity={active ? 0.12 : 0}
                className={`mb-0.5 transition-transform duration-300 ease-spring ${active ? 'scale-110' : ''}`}
              />
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