import type { ReactNode } from 'react';

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'link';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  className,
  ...props
}: ButtonProps) {
  const baseClasses =
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2';
  const variantClasses = {
    primary: 'bg-brand text-white hover:bg-brand/90',
    secondary: 'bg-white text-brand border border-brand hover:bg-gray-50',
    danger: 'bg-destructive text-white hover:bg-destructive/90',
    link: 'underline underline-offset-4 text-brand hover:opacity-90',
  };
  const sizeClasses = {
    sm: 'h-8 py-1 px-2',
    md: 'h-10 py-2 px-4',
    lg: 'h-12 py-3 px-8',
  };

  return (
    <button
      className={[
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
