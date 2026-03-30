import React, { useState, useCallback } from 'react';
import api from '../../config/api';
import { useToast } from '../ui/Toast';
import ImportProgressBar from './ImportProgressBar';

interface ImportLeadsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 1 | 2 | 3 | 4 | 5;

const LEAD_FIELDS = ['email', 'phone', 'name', 'status', 'source', 'notes', 'tags'];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_MIME = [
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

interface PreviewData {
  columns: string[];
  rows: Record<string, string>[];
  totalRows: number;
  suggestedMapping: Record<string, string>;
}

interface FieldMapping {
  [csvColumn: string]: string; // '' means unmapped
}

interface ImportConfig {
  skipDuplicates: boolean;
  defaultSource: string;
  defaultStatus: string;
}

interface ImportStats {
  totalRecords: number;
  successfulImports: number;
  failedImports: number;
  duplicatesSkipped: number;
}

interface RowError {
  row: number;
  error: string;
}

interface ImportResult {
  stats: ImportStats;
  errors: RowError[];
}

// ── Step indicator ──────────────────────────────────────────────────────────
const STEP_LABELS = ['Upload', 'Preview & Map', 'Confirm', 'Processing', 'Result'];

const StepIndicator: React.FC<{ current: Step }> = ({ current }) => (
  <div className="flex items-center justify-between mb-6 px-2">
    {STEP_LABELS.map((label, i) => {
      const step = (i + 1) as Step;
      const done = step < current;
      const active = step === current;
      return (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                ${done ? 'bg-green-500 text-white' : active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-500'}`}
            >
              {done ? '✓' : step}
            </div>
            <span className={`text-xs ${active ? 'text-blue-600 font-semibold' : 'text-gray-400'}`}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-1 ${done ? 'bg-green-400' : 'bg-gray-200'}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ── Template CSV download ───────────────────────────────────────────────────
const downloadTemplate = () => {
  const headers = 'email,phone,name,status,source,notes,tags';
  const row1 = 'alice@example.com,+1-555-0100,Alice Smith,new,form,"Interested in hiking trips","adventure,hiking"';
  const row2 = 'bob@example.com,+1-555-0101,Bob Jones,contacted,inquiry,"Wants group discount","family"';
  const csv = [headers, row1, row2].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'leads_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

// ── Main component ──────────────────────────────────────────────────────────
const ImportLeadsModal: React.FC<ImportLeadsModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { add } = useToast();
  const [step, setStep] = useState<Step>(1);

  // Step 1
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>('');

  // Step 2
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({});
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Step 3
  const [config, setConfig] = useState<ImportConfig>({
    skipDuplicates: true,
    defaultSource: '',
    defaultStatus: 'new',
  });

  // Step 4
  const [importId, setImportId] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  // Step 5
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  // ── Reset on close ────────────────────────────────────────────────────────
  const handleClose = () => {
    setStep(1);
    setFile(null);
    setFileError('');
    setPreview(null);
    setFieldMapping({});
    setConfig({ skipDuplicates: true, defaultSource: '', defaultStatus: 'new' });
    setImportId('');
    setSubmitting(false);
    setResult(null);
    setErrorsExpanded(false);
    onClose();
  };

  // ── Step 1: file selection ────────────────────────────────────────────────
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('');
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.size > MAX_FILE_SIZE) {
      setFileError('File exceeds 10 MB limit. Please upload a smaller file.');
      return;
    }
    const ext = selected.name.split('.').pop()?.toLowerCase();
    if (!ACCEPTED_MIME.includes(selected.type) && ext !== 'csv' && ext !== 'xlsx') {
      setFileError('Only .csv and .xlsx files are accepted.');
      return;
    }
    setFile(selected);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files?.[0];
    if (!dropped) return;
    // Reuse same validation via synthetic event simulation
    const dt = new DataTransfer();
    dt.items.add(dropped);
    const fakeEvent = { target: { files: dt.files } } as unknown as React.ChangeEvent<HTMLInputElement>;
    handleFileChange(fakeEvent);
  };

  const goToPreview = async () => {
    if (!file) return;
    setLoadingPreview(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/api/database-import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const data: PreviewData = res.data;
      setPreview(data);
      // Initialise mapping from suggestions
      const initial: FieldMapping = {};
      (data.columns || []).forEach((col) => {
        initial[col] = data.suggestedMapping?.[col] ?? '';
      });
      setFieldMapping(initial);
      setStep(2);
    } catch (err: any) {
      add(err.response?.data?.error || 'Failed to preview file. Check the format and try again.', 'error');
    } finally {
      setLoadingPreview(false);
    }
  };

  // ── Step 3 → 4: submit import ─────────────────────────────────────────────
  const startImport = async () => {
    if (!file) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fieldMapping', JSON.stringify(fieldMapping));
      formData.append('config', JSON.stringify(config));

      const res = await api.post('/api/database-import/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      // Expect 202 { importId, message }
      setImportId(res.data.importId);
      setStep(4);
    } catch (err: any) {
      if (err.response?.status === 429) {
        add('Import rate limit reached. You can import up to 10 times per hour.', 'error');
      } else {
        add(err.response?.data?.error || 'Failed to start import.', 'error');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Step 4 → 5: polling complete ─────────────────────────────────────────
  const handleImportComplete = useCallback((stats: any) => {
    setResult({ stats, errors: stats?.errors ?? [] });
    setStep(5);
    onSuccess();
  }, [onSuccess]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b flex justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-gray-900">📥 Import Leads</h2>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 pt-5 shrink-0">
          <StepIndicator current={step} />
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* ── Step 1: Upload ── */}
          {step === 1 && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                Upload a <strong>.csv</strong> or <strong>.xlsx</strong> file (max 10 MB).{' '}
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="text-blue-600 underline hover:text-blue-800 text-sm"
                >
                  Download template
                </button>
              </p>

              {/* Drop zone */}
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={`relative flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-8 cursor-pointer transition-colors
                  ${fileError ? 'border-red-400 bg-red-50' : file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 bg-gray-50'}`}
              >
                <svg className="w-12 h-12 text-gray-400 mb-3" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                  <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {file ? (
                  <p className="text-green-700 font-medium">{file.name}</p>
                ) : (
                  <p className="text-gray-500 text-sm">Drag & drop or <span className="text-blue-600 font-medium">browse</span></p>
                )}
                <p className="text-xs text-gray-400 mt-1">.csv, .xlsx — up to 10 MB</p>
                <input
                  type="file"
                  accept=".csv,.xlsx,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={handleFileChange}
                />
              </div>

              {fileError && (
                <p className="text-red-600 text-sm flex items-center gap-1">
                  <span>⚠️</span> {fileError}
                </p>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={goToPreview}
                  disabled={!file || !!fileError || loadingPreview}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loadingPreview && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {loadingPreview ? 'Loading preview…' : 'Next: Preview →'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview & Map ── */}
          {step === 2 && preview && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600">
                Map your file's columns to lead fields. Auto-suggestions are pre-filled where possible.
              </p>

              {/* Mapping table */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-gray-600 font-medium">CSV Column</th>
                      <th className="px-4 py-2 text-left text-gray-600 font-medium">Maps to Lead Field</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {preview.columns.map((col) => (
                      <tr key={col}>
                        <td className="px-4 py-2 font-mono text-gray-700">{col}</td>
                        <td className="px-4 py-2">
                          <select
                            value={fieldMapping[col] ?? ''}
                            onChange={(e) => setFieldMapping((m) => ({ ...m, [col]: e.target.value }))}
                            className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          >
                            <option value="">— skip —</option>
                            {LEAD_FIELDS.map((f) => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Sample rows */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Sample rows (first 5)</p>
                <div className="overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {preview.columns.map((col) => (
                          <th key={col} className="px-3 py-2 text-left text-gray-500 font-medium whitespace-nowrap">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {preview.rows.slice(0, 5).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {preview.columns.map((col) => (
                            <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[160px] truncate">{row[col] ?? ''}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-400 mt-1">{preview.totalRows} total rows detected</p>
              </div>

              <div className="flex justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  Next: Confirm →
                </button>
              </div>
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 3 && preview && (
            <div className="space-y-5">
              {/* Summary */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1">
                <p className="font-semibold text-blue-800">Import Summary</p>
                <p className="text-sm text-blue-700">File: <strong>{file?.name}</strong></p>
                <p className="text-sm text-blue-700">Total rows: <strong>{preview.totalRows}</strong></p>
                <p className="text-sm text-blue-700">
                  Mapped fields: <strong>{Object.values(fieldMapping).filter(Boolean).length}</strong> of {preview.columns.length}
                </p>
              </div>

              {/* Config options */}
              <div className="space-y-4">
                <p className="text-sm font-semibold text-gray-700">Import Options</p>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={config.skipDuplicates}
                    onChange={(e) => setConfig((c) => ({ ...c, skipDuplicates: e.target.checked }))}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Skip duplicate emails (same organizer)</span>
                </label>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Default Source</label>
                  <select
                    value={config.defaultSource}
                    onChange={(e) => setConfig((c) => ({ ...c, defaultSource: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">— none —</option>
                    <option value="form">Form</option>
                    <option value="inquiry">Inquiry</option>
                    <option value="chat">Chat</option>
                    <option value="trip_view">Trip View</option>
                    <option value="partial_booking">Partial Booking</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm text-gray-700 mb-1">Default Status</label>
                  <select
                    value={config.defaultStatus}
                    onChange={(e) => setConfig((c) => ({ ...c, defaultStatus: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="interested">Interested</option>
                    <option value="negotiating">Negotiating</option>
                    <option value="booked">Booked</option>
                    <option value="lost">Lost</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
                >
                  ← Back
                </button>
                <button
                  type="button"
                  onClick={startImport}
                  disabled={submitting}
                  className="px-5 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {submitting && (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                  )}
                  {submitting ? 'Starting…' : '🚀 Start Import'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step 4: Processing ── */}
          {step === 4 && (
            <div className="space-y-6 py-4">
              <p className="text-center text-gray-600 text-sm">
                Your import is being processed in the background. Please wait…
              </p>
              {importId && (
                <ImportProgressBar importId={importId} onComplete={handleImportComplete} />
              )}
              <p className="text-center text-xs text-gray-400">Do not close this window until the import completes.</p>
            </div>
          )}

          {/* ── Step 5: Result ── */}
          {step === 5 && result && (
            <div className="space-y-5">
              {/* Stats */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-green-700">{result.stats?.successfulImports ?? 0}</p>
                  <p className="text-sm text-green-600 mt-1">Imported</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-red-700">{result.stats?.failedImports ?? 0}</p>
                  <p className="text-sm text-red-600 mt-1">Failed</p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-yellow-700">{result.stats?.duplicatesSkipped ?? 0}</p>
                  <p className="text-sm text-yellow-600 mt-1">Duplicates Skipped</p>
                </div>
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
                  <p className="text-3xl font-bold text-gray-700">{result.stats?.totalRecords ?? 0}</p>
                  <p className="text-sm text-gray-500 mt-1">Total Rows</p>
                </div>
              </div>

              {/* Per-row errors */}
              {result.errors && result.errors.length > 0 && (
                <div>
                  <button
                    type="button"
                    onClick={() => setErrorsExpanded((v) => !v)}
                    className="flex items-center gap-2 text-sm text-red-600 font-medium hover:text-red-800"
                  >
                    <span>{errorsExpanded ? '▾' : '▸'}</span>
                    {result.errors.length} row error{result.errors.length !== 1 ? 's' : ''} — click to {errorsExpanded ? 'hide' : 'expand'}
                  </button>
                  {errorsExpanded && (
                    <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-red-200 bg-red-50">
                      <table className="min-w-full text-xs">
                        <thead className="bg-red-100">
                          <tr>
                            <th className="px-3 py-2 text-left text-red-700 font-medium">Row</th>
                            <th className="px-3 py-2 text-left text-red-700 font-medium">Error</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-red-100">
                          {result.errors.map((e, i) => (
                            <tr key={i}>
                              <td className="px-3 py-1.5 text-red-600 font-mono">{e.row}</td>
                              <td className="px-3 py-1.5 text-red-700">{e.error}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportLeadsModal;
