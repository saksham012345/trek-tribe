import React, { ButtonHTMLAttributes } from 'react';

// Using a simple conditional class joiner
const clsx = (...classes: (string | undefined | null | false)[]) => classes.filter(Boolean).join(' ');

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  fullWidth?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, fullWidth, children, disabled, ...props }, ref) => {
    
    // Core brand color overrides based on the #b4d4b4 design token request (and current index.css)
    const variants = {
      primary: 'bg-forest-600 text-white hover:bg-forest-700 shadow-sm active:scale-[0.98]',
      secondary: 'bg-[#b4d4b4] text-forest-900 hover:bg-[#a3c7a3] shadow-sm active:scale-[0.98]',
      outline: 'border-2 border-gray-200 text-gray-700 hover:border-forest-500 hover:text-forest-700 bg-transparent active:scale-[0.98]',
      ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 active:scale-[0.98]',
      danger: 'bg-red-50 text-red-600 hover:bg-red-100 active:scale-[0.98]',
    };

    const sizes = {
      sm: 'px-3 py-1.5 text-xs font-semibold rounded-xl',
      md: 'px-5 py-2.5 text-sm font-bold rounded-2xl',
      lg: 'px-6 py-3.5 text-base font-bold rounded-2xl',
      icon: 'p-2.5 rounded-xl flex items-center justify-center',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={clsx(
          'inline-flex items-center justify-center transition-all duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-forest-500',
          variants[variant],
          sizes[size],
          fullWidth ? 'w-full' : '',
          (disabled || isLoading) ? 'opacity-60 cursor-not-allowed transform-none' : '',
          className
        )}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';
