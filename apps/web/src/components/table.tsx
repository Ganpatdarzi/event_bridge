import type { ReactNode } from 'react';

export interface TableHeaders {
  [key: string]: string;
}

export interface TableRow {
  cells: Record<string, string | number | ReactNode>;
}

export interface TableProps {
  headers: TableHeaders;
  rows: TableRow[];
  className?: string;
  onRowClick?: (row: TableRow) => void;
}

export function Table({ headers, rows, className, onRowClick }: TableProps) {
  const allClasses = ['overflow-x-auto rounded-md border', className].filter(Boolean).join(' ');
  const columns = Object.entries(headers);

  return (
    <div className={allClasses}>
      <table className="w-full min-w-full text-sm font-medium text-gray-500 dark:text-gray-400">
        <thead>
          <tr>
            {columns.map(([key, label]) => (
              <th
                key={key}
                className="px-4 py-2 text-left text-xs font-medium capitalize text-gray-500 dark:text-gray-400"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={
                onRowClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : undefined
              }
              onClick={() => onRowClick?.(row)}
            >
              {columns.map(([key]) => (
                <td key={key} className="px-4 py-2 text-sm text-gray-900 dark:text-gray-100">
                  {row.cells[key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
