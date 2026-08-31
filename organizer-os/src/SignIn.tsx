import React from 'react';
import { useAuth } from '@web/contexts/AuthContext';

/**
 * Sign-in, organizer only.
 *
 * The same credentials as the main site — this app talks to the same API and
 * the same accounts — but it says so plainly, because someone opening a URL on
 * port 3002 has no other way to know which system they are signing in to.
 */
const SignIn: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await login(email, password);
    if (!res.success) setError(res.error || 'Could not sign in');
    setBusy(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-forest-800">TrekTribe Organizer OS</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your TrekTribe organizer account. Same login as the main site.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}
          <input
            id="email"
            type="text"
            autoComplete="username"
            placeholder="username or you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !email || !password}
            className="w-full rounded bg-forest-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <p className="mt-4 text-xs text-gray-400">
          Travellers should use the main site. This app only opens for organizer and
          admin accounts.
        </p>
      </div>
    </div>
  );
};

export default SignIn;
