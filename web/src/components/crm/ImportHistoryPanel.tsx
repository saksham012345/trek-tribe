import React, { useEffect, useState, useCallback } from 'react';
import api from '../../config/api';

interface ImportStats {
  totalRecords: number;
  successfulImports: number;
  failedImports: number;
  duplicatesSkipped?: number;
}

interface ImportRecord {
  _id: string;
  fileName: string;
  fileType: string;
  status: 'processing' | 'completed' | 'failed' | 'partially_completed';
  stats: ImportStats;
  createdAt: string;
  canRollback: boolean;
  rolledBackAt?: string;
}

interface ImportHistoryPanelProps {
  refreshKey: number;
  onRollback: () => void;
}

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  completed:           { bg: 'bg-green-100',  text: 'text-green-700',  label: 'Completed' },
  failed:              { bg: 'bg-red-100',    text: 'text-red-700',    label: 'Failed' },
  processing:          { bg: 'bg-blue-100',   text: 'text-blue-700',   label: 'Processing' },
  partially_completed: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Partial' },
};

const ImportHistoryPanel: React.FC<ImportHistoryPanelProps> = ({ refreshKey, onRollback }) => {
  const [records, setRecords] = useState<ImportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/api/database-import/history');
      setRecords(res.data?.data ?? res.data ?? []);
    } catch {
      setError('Failed to load import history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHistory();
  }, [refreshKey, fetchHistory]);

  const handleRollback = async (record: ImportRecord) => {
    const confirmed = window.confirm(
      `Roll back import of "${record.fileName}"?\n\nThis will permanently delete all ${record.stats.successfulImports} leads imported in this batch. This action cannot be undone.`
    );
    if (!confirmed) return;

    setRollingBack(record._id);
    try {
      await api.post(`/api/database-import/${record._id}/rollback`);
      await fetchHistory();
      onRollback();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? 'Rollback failed. Please try again.';
      alert(msg);
    } finally {
      setRollingBack(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-gray-400 text-sm">
        <svg className="animate-spin h-5 w-5 mr-2 text-indigo-500" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Loading import history…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-10 text-red-500 text-sm">
        {error}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-gray-400 text-sm gap-2">
        <svg className="h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        No imports yet.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500 text-xs uppercase tracking-wide">
            <th className="pb-3 pr-4">File</th>
            <th className="pb-3 pr-4">Date</th>
            <th className="pb-3 pr-4 text-right">Imported</th>
            <th className="pb-3 pr-4 text-right">Failed</th>
            <th className="pb-3 pr-4">Status</th>
            <th className="pb-3" />
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const badge = STATUS_BADGE[record.status] ?? STATUS_BADGE.processing;
            const isRollingBack = rollingBack === record._id;
            const date = new Date(record.createdAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            });

            return (
              <tr key={record._id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50 transition-colors">
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-2">
                    <svg className="h-4 w-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="font-medium text-gray-800 truncate max-w-[180px]" title={record.fileName}>
                      {record.fileName}
                    </span>
                  </div>
                  {record.rolledBackAt && (
                    <span className="text-xs text-gray-400 ml-6">
                      Rolled back {new Date(record.rolledBackAt).toLocaleDateString()}
                    </span>
                  )}
                </td>
                <td className="py-3 pr-4 text-gray-500 whitespace-nowrap">{date}</td>
                <td className="py-3 pr-4 text-right font-medium text-green-700">
                  {record.stats.successfulImports.toLocaleString()}
                </td>
                <td className="py-3 pr-4 text-right font-medium text-red-600">
                  {record.stats.failedImports.toLocaleString()}
                </td>
                <td className="py-3 pr-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}>
                    {badge.label}
                  </span>
                </td>
                <td className="py-3 text-right">
                  {record.canRollback && !record.rolledBackAt && (
                    <button
                      onClick={() => handleRollback(record)}
                      disabled={isRollingBack}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isRollingBack ? (
                        <>
                          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Rolling back…
                        </>
                      ) : (
                        <>
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                          </svg>
                          Rollback
                        </>
                      )}
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ImportHistoryPanel;
