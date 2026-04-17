import React, { HTMLAttributes } from 'react';

const clsx = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'neutral' | 'success' | 'warning' | 'error' | 'brand';
  size?: 'sm' | 'md';
}

export function Badge({ className, variant = 'neutral', size = 'sm', children, ...props }: BadgeProps) {
  const variants = {
    neutral: 'bg-gray-100 text-gray-700 border-gray-200',
    success: 'bg-green-50 text-green-700 border-green-200',
    warning: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    brand: 'bg-forest-50 text-forest-700 border-forest-100',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-[10px] md:text-xs tracking-wider uppercase',
    md: 'px-3 py-1 text-xs md:text-sm font-semibold',
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center font-bold rounded-xl border',
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
