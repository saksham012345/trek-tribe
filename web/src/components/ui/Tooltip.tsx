import React, { useState } from 'react';

type TooltipProps = {
  label?: string;
  text?: string;
  children?: React.ReactNode;
};

export const Tooltip: React.FC<TooltipProps> = ({ label, text, children }) => {
  const [open, setOpen] = useState(false);
  const content = label ?? text ?? '';

  return (
    <span
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children ?? (
        <span className="inline-flex items-center justify-center w-4 h-4 text-xs font-semibold rounded-full bg-gray-200 text-gray-700">
          i
        </span>
      )}
      {open && content && (
        <span className="absolute left-1/2 -translate-x-1/2 mt-2 whitespace-nowrap text-xs bg-gray-900 text-white px-2 py-1 rounded shadow">
          {content}
        </span>
      )}
    </span>
  );
};

export default Tooltip;
