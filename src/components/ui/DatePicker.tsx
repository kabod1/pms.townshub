import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { classNames } from '@/lib/utils'

interface DatePickerProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export const DatePicker = forwardRef<HTMLInputElement, DatePickerProps>(
  ({ label, error, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-body">
            {label}
          </label>
        )}
        <input
          ref={ref}
          type="date"
          id={inputId}
          className={classNames(
            'w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body',
            'focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue',
            'disabled:cursor-not-allowed disabled:bg-gray-50',
            error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
            className,
          )}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    )
  },
)
DatePicker.displayName = 'DatePicker'
