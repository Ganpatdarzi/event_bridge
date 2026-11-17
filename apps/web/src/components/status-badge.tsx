import type { ReactNode } from 'react';

export interface StatusBadgeProps {
  status:
    | 'pending_review'
    | 'verified'
    | 'changes_requested'
    | 'rejected'
    | 'suspended'
    | 'deactivated'
    | 'draft'
    | 'submitted'
    | 'open'
    | 'partially_quoted'
    | 'quoted'
    | 'selected'
    | 'completed'
    | 'closed'
    | 'cancelled';
  _size?: 'sm' | 'md' | 'lg';
  _className?: string;
  children?: ReactNode;
}

const statusClasses = {
  pending_review: 'bg-yellow-100 text-yellow-800',
  verified: 'bg-green-100 text-green-800',
  changes_requested: 'bg-orange-100 text-orange-800',
  rejected: 'bg-red-100 text-red-800',
  suspended: 'bg-blue-100 text-blue-800',
  deactivated: 'bg-gray-100 text-gray-600',
  draft: 'bg-gray-100 text-gray-600',
  submitted: 'bg-blue-100 text-blue-800',
  open: 'bg-green-100 text-green-800',
  partially_quoted: 'bg-blue-100 text-blue-800',
  quoted: 'bg-purple-100 text-purple-800',
  selected: 'bg-purple-100 text-purple-800',
  completed: 'bg-indigo-100 text-indigo-800',
  closed: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
};

const sizeClasses = {
  sm: 'text-xs py-0.5 px-2',
  md: 'text-sm py-1 px-3',
  lg: 'text-base py-2 px-4',
};

export function StatusBadge({ status, _size = 'md', _className, children }: StatusBadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-md',
        sizeClasses[_size],
        statusClasses[status],
        _className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {status}
      {children && <span>{children}</span>}
    </span>
  );
}
