import React, { useEffect, useState } from 'react';

/**
 * AutoPayToggle
 * Small component to toggle the organizer's auto-pay setting.
 * Backend endpoint: POST /api/organizer/auto-pay (body: { enabled: boolean })
 */
export default function AutoPayToggle() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // fetch current state on mount
    (async () => {
      try {
        const res = await fetch('/api/organizer/auto-pay');
        if (!res.ok) return;
        const data = await res.json();
        setEnabled(!!data.enabled);
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  async function toggle() {
    setLoading(true);
    try {
      const res = await fetch('/api/organizer/auto-pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !enabled }),
      });
      if (res.ok) setEnabled(!enabled);
    } catch (e) {
      console.error(e);
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
      <div style={{ marginTop: 6, color: '#666' }}>Toggle auto-pay for organizer subscription charges.</div>
    </div>
  );
}
