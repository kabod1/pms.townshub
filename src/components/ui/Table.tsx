import type { ReactNode } from 'react'
import { classNames } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (row: T) => string
  onRowClick?: (row: T) => void
  emptyMessage?: string
}

export function Table<T>({ columns, data, keyExtractor, onRowClick, emptyMessage }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-mid">
      <table className="min-w-full divide-y divide-mid">
        <thead className="bg-light">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                className={classNames(
                  'px-3 sm:px-4 py-2 sm:py-3 text-left text-xs font-semibold uppercase tracking-wider text-subtext',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-mid bg-white">
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-sm text-subtext">
                {emptyMessage ?? 'No records found'}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={keyExtractor(row)}
                onClick={() => onRowClick?.(row)}
                className={classNames(
                  'transition-colors',
                  onRowClick && 'cursor-pointer hover:bg-light',
                )}
              >
                {columns.map((col) => (
                  <td key={col.key} className={classNames('px-3 sm:px-4 py-2 sm:py-3 text-sm text-body', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
