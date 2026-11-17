import type { ChangeEvent } from 'react';

export interface TextareaProps {
  placeholder?: string;
  disabled?: boolean;
  rows?: number;
  className?: string;
  title?: string;
  titleHidden?: boolean;
  onChange?: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  value?: string;
}

export function Textarea({
  placeholder = '',
  disabled = false,
  rows = 3,
  className,
  title,
  titleHidden = false,
  ...props
}: TextareaProps) {
  const textareaClasses = [
    'block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-brand sm:text-sm',
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
      <textarea
        placeholder={placeholder}
        disabled={disabled}
        rows={rows}
        className={textareaClasses}
        {...props}
      />
    </div>
  );
}
