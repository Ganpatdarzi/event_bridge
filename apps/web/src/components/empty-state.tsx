import type { ReactNode } from 'react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={`text-center py-12 ${className}`}>
      {icon && (
        <div className="w-12 h-12 mx-auto rounded-md flex items-center justify-center mb-4">
          {icon}
        </div>
      )}
      <h2 className="text-xl font-medium text-gray-900 dark:text-gray-100">{title}</h2>
      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{description}</p>
      )}
      {action && (
        <button className="mt-4 inline-flex items-center gap-2 rounded-md border-transparent bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90">
          {action.label}
        </button>
      )}
    </div>
  );
}
