import React, { useState } from 'react';

export const Tooltip: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <span className="relative inline-flex" onMouseEnter={()=>setOpen(true)} onMouseLeave={()=>setOpen(false)}>
      {children}
      {open && (
        <span className="absolute left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap text-xs bg-gray-900 text-white px-2 py-1 rounded shadow">
          {label}
        </span>
      )}
    </span>
  );
};
