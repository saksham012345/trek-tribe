import React, { useEffect, useState } from 'react';

/**
 * AutoPayToggle
 * Small component to toggle the organizer's auto-pay setting.
 * Backend endpoint: POST /api/organizer/auto-pay (body: { enabled: boolean })
 */
export default function AutoPayToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // fetch current state on mount
    (async () => {
      try {
        const res = await fetch('/api/organizer/auto-pay');
        if (!res.ok) throw new Error('Failed to fetch auto-pay status');
        const data = await res.json();
        setEnabled(!!data.enabled);
      } catch (e) {
        console.error(e);
        setError('Failed to load auto-pay status. You may not have access or the server is down.');
      }
    })();
  }, []);

  async function toggle() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/organizer/auto-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (res.ok) setEnabled(!enabled);
      else throw new Error('Failed to update auto-pay');
    } catch (e) {
      console.error(e);
      setError('Failed to update auto-pay. You may not have access or the server is down.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div>
        <label>
          <input type="checkbox" checked={enabled} onChange={toggle} disabled={loading} /> Auto-pay
        </label>
      </div>
      {error && <div style={{ color: 'red', marginTop: 8 }}>{error}</div>}
      <div style={{ marginTop: 6, color: '#666' }}>Toggle auto-pay for organizer subscription charges.</div>
    </div>
  );
}
