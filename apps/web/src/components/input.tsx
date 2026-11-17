import type { ChangeEvent } from 'react';

export interface InputProps {
  type?: string;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  className?: string;
  title?: string;
  titleHidden?: boolean;
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  value?: string;
  autoFocus?: boolean;
}

export function Input({
  type = 'text',
  placeholder,
  disabled = false,
  readOnly = false,
  className,
  title,
  titleHidden = false,
  onChange,
  value,
  autoFocus,
  ...props
}: InputProps) {
  const inputClasses = [
    'block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-brand sm:text-sm',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="space-y-1.5">
      {title && (
        <label
          className="block text-sm font-medium text-gray-700 dark:text-gray-200"
          {...(titleHidden ? { style: { display: 'none' } } : {})}
        >
          {title}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        disabled={disabled}
        readOnly={readOnly}
        className={inputClasses}
        onChange={onChange}
        value={value}
        autoFocus={autoFocus}
        {...props}
      />
    </div>
  );
}
