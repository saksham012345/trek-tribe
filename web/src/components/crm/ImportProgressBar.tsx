import React, { useEffect, useRef, useCallback } from 'react';
import api from '../../config/api';

interface ImportProgressBarProps {
  importId: string;
  onComplete: (stats: any) => void;
}

interface StatusResponse {
  status: 'processing' | 'completed' | 'failed' | 'partially_completed';
  processedRows: number;
  totalRows: number;
  progressPercentage: number;
  stats?: any;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; bar: string; label: string }> = {
  processing:          { bg: 'bg-blue-100',   text: 'text-blue-700',   bar: 'bg-blue-500',   label: 'Processing' },
  completed:           { bg: 'bg-green-100',  text: 'text-green-700',  bar: 'bg-green-500',  label: 'Completed' },
  failed:              { bg: 'bg-red-100',    text: 'text-red-700',    bar: 'bg-red-500',    label: 'Failed' },
  partially_completed: { bg: 'bg-yellow-100', text: 'text-yellow-700', bar: 'bg-yellow-500', label: 'Partially Completed' },
};

const ImportProgressBar: React.FC<ImportProgressBarProps> = ({ importId, onComplete }) => {
  const [data, setData] = React.useState<StatusResponse>({
    status: 'processing',
    processedRows: 0,
    totalRows: 0,
    progressPercentage: 0,
  });

  // Stable ref so the interval callback always sees the latest onComplete
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);

  const poll = useCallback(async () => {
    try {
      const res = await api.get(`/api/database-import/${importId}/status`);
      // Backend wraps response: { success, data: { status, processedRows, ... } }
      const d: StatusResponse = res.data?.data ?? res.data;
      setData(d);
      if (d.status !== 'processing') {
        return true; // signal: stop polling
      }
    } catch {
      // ignore transient network errors — keep polling
    }
    return false;
  }, [importId]);

  useEffect(() => {
    if (!importId) return;

    let stopped = false;

    const run = async () => {
      const done = await poll();
      if (done) {
        stopped = true;
        // Read latest data via functional updater to call onComplete with final stats
        setData((prev) => {
          onCompleteRef.current(prev.stats ?? {});
          return prev;
        });
        return;
      }
      if (!stopped) {
        timerId = window.setTimeout(run, 3000);
      }
    };

    let timerId = window.setTimeout(run, 0);

    return () => {
      stopped = true;
      clearTimeout(timerId);
    };
  }, [importId, poll]);

  const style = STATUS_STYLES[data.status] ?? STATUS_STYLES.processing;
  const pct = Math.min(100, Math.max(0, data.progressPercentage));

  return (
    <div className="space-y-3">
      {/* Row count + status badge */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">
          {data.processedRows.toLocaleString()} / {data.totalRows.toLocaleString()} rows processed
        </span>
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
          {data.status === 'processing' && (
            <svg className="animate-spin -ml-0.5 mr-1.5 h-3 w-3" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {style.label}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
        <div
          className={`h-3 rounded-full transition-all duration-500 ease-out ${style.bar} ${data.status === 'processing' ? 'animate-pulse' : ''}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Percentage label */}
      <p className="text-center text-sm text-gray-500">{pct}% complete</p>
    </div>
  );
};

export default ImportProgressBar;
