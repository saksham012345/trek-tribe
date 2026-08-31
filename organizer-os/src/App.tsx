import React from 'react';
import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@web/contexts/AuthContext';
import { ToastProvider } from '@web/components/ui/Toast';
import OrganizerNav from '@web/pages/organizer-os/OrganizerNav';
import SignIn from './SignIn';
import { organizerRoutes } from './routes';

/**
 * Everything an organizer does, on its own.
 *
 * The screens are the ones the main site renders under /organizer — imported,
 * not copied — so this is a second way to run the same code rather than a fork
 * of it. What differs is the shell: no traveller header, no discovery, and the
 * navigation is always present instead of living at the bottom of a dashboard.
 */

const Chrome: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
          <Link to="/" className="text-lg font-semibold text-forest-800">
            TrekTribe <span className="font-normal text-gray-400">Organizer OS</span>
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-gray-600">{user?.name}</span>
            <button
              onClick={logout}
              className="rounded border border-gray-300 px-3 py-1.5 text-gray-700 hover:bg-gray-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-8 px-6 py-6">
        {/* Always on screen, rather than at the foot of a dashboard. Thirty-one
            screens are only useful if you can see that they exist. */}
        <aside className="w-64 shrink-0">
          <div className="sticky top-6 rounded-lg border border-gray-200 bg-white p-4">
            <OrganizerNav />
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <footer className="mx-auto max-w-7xl px-6 pb-8 text-xs text-gray-400">
        {pathname}
      </footer>
    </div>
  );
};

const Guarded: React.FC = () => {
  const { user, loading } = useAuth() as any;

  if (loading) return <div className="p-10 text-gray-500">Loading…</div>;
  if (!user) return <SignIn />;
  if (user.role !== 'organizer' && user.role !== 'admin') {
    return (
      <div className="p-10">
        <h1 className="text-xl font-semibold text-gray-900">Not an organizer account</h1>
        <p className="mt-2 text-sm text-gray-600">
          This app is the organizer side only. {user.email} is signed in as {user.role}.
        </p>
      </div>
    );
  }

  return (
    <Chrome>
      <Routes>
        <Route path="/" element={<Navigate to="/organizer" replace />} />
        {organizerRoutes(user).map(({ path, element }) => (
          <Route key={path} path={path} element={element} />
        ))}
        <Route
          path="*"
          element={
            <div className="p-10">
              <h1 className="text-xl font-semibold text-gray-900">No such screen</h1>
              <p className="mt-2 text-sm text-gray-600">
                Pick one from the list on the left.
              </p>
            </div>
          }
        />
      </Routes>
    </Chrome>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <ToastProvider>
      <Guarded />
    </ToastProvider>
  </AuthProvider>
);

export default App;
