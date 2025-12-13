import React, { createContext, useContext, useState, useCallback } from 'react';

type Toast = { id: number; message: string; type?: 'success'|'error'|'info' };

const ToastContext = createContext<{ add: (m: string, type?: Toast['type']) => void }|null>(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const add = useCallback((message: string, type: Toast['type'] = 'info') => {
    const id = Date.now();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter(x => x.id !== id)), 3000);
  }, []);

  return (
    <ToastContext.Provider value={{ add }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 space-y-2 z-50">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded-lg shadow text-white ${t.type==='success'?'bg-emerald-600':t.type==='error'?'bg-red-600':'bg-gray-800'}`}>{t.message}</div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
