import React from 'react';

// Shared pieces for the Sprint 3 read-only analytics screens. These four
// screens differ only in what they fetch and how a row renders, so the
// loading, error and empty states live here once.

export const inr = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n || 0);

export const pct = (n: number) => `${(n ?? 0).toFixed(2)}%`;

export function useAnalytics<T>(path: string) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    import('../../services/apiClient')
      .then(({ apiClient }) => apiClient.get(path))
      .then((res) => {
        if (alive) setData(res.data);
      })
      .catch((e: any) => {
        if (alive) setError(e?.response?.data?.error || e?.message || 'Request failed');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [path]);

  return { data, error, loading };
}

export const Shell: React.FC<{
  title: string;
  subtitle?: string;
  loading: boolean;
  error: string | null;
  empty?: boolean;
  children: React.ReactNode;
}> = ({ title, subtitle, loading, error, empty, children }) => (
  <div className="p-6 max-w-7xl mx-auto">
    <header className="mb-6">
      <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
    </header>

    {loading && <div className="py-16 text-center text-gray-500">Loading…</div>}

    {!loading && error && (
      <div className="rounded border border-red-200 bg-red-50 p-4 text-red-800">
        <div className="font-medium">Could not load this view</div>
        <div className="text-sm mt-1">{error}</div>
      </div>
    )}

    {!loading && !error && empty && (
      <div className="py-16 text-center text-gray-500">
        Nothing to show yet — this fills in once trips have bookings.
      </div>
    )}

    {!loading && !error && !empty && children}
  </div>
);

export const StatTile: React.FC<{ label: string; value: string; hint?: string }> = ({
  label,
  value,
  hint,
}) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4">
    <div className="text-xs uppercase tracking-wide text-gray-500">{label}</div>
    <div className="text-xl font-semibold text-gray-900 mt-1">{value}</div>
    {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
  </div>
);

export const Table: React.FC<{ head: string[]; children: React.ReactNode }> = ({
  head,
  children,
}) => (
  <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
    <table className="min-w-full text-sm">
      <thead className="bg-gray-50 text-gray-600">
        <tr>
          {head.map((h) => (
            <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-100">{children}</tbody>
    </table>
  </div>
);
