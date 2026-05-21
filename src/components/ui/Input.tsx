import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'
import { classNames } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, className, id, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-')
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-body">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="absolute inset-y-0 left-3 flex items-center text-subtext">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={classNames(
              'w-full rounded-lg border border-mid bg-white px-3 py-2 text-sm text-body placeholder:text-subtext',
              'focus:border-blue focus:outline-none focus:ring-1 focus:ring-blue',
              'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-subtext',
              error && 'border-red-500 focus:border-red-500 focus:ring-red-500',
              leftIcon ? 'pl-9' : undefined,
              className,
            )}
            {...props}
          />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-subtext">{hint}</p>}
      </div>
    )
  },
)
Input.displayName = 'Input'
