import React, { HTMLAttributes } from 'react';

const clsx = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
}

export function Card({ className, padding = 'md', interactive = false, children, ...props }: CardProps) {
  const paddings = {
    none: '',
    sm: 'p-4',
    md: 'p-5 md:p-6',
    lg: 'p-8',
  };

  return (
    <div
      className={clsx(
        'bg-white rounded-3xl border border-gray-100',
        'shadow-[0_8px_30px_rgb(0,0,0,0.04)]',
        interactive ? 'transition-all duration-300 hover:shadow-[0_20px_40px_rgb(0,0,0,0.08)] hover:-translate-y-1 cursor-pointer' : '',
        paddings[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
