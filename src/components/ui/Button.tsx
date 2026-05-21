import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'
import { classNames } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  fullWidth?: boolean
}

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-gold text-white hover:bg-yellow-600 focus-visible:outline-gold disabled:opacity-50',
  secondary:
    'bg-navy text-white hover:bg-blue-900 focus-visible:outline-navy disabled:opacity-50',
  ghost:
    'bg-transparent text-navy hover:bg-light focus-visible:outline-navy disabled:opacity-40',
  danger:
    'bg-red-700 text-white hover:bg-red-800 focus-visible:outline-red-700 disabled:opacity-50',
  outline:
    'border border-mid text-body bg-white hover:bg-light focus-visible:outline-navy disabled:opacity-40',
}

const sizeClasses: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-11 px-6 text-base',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && 'w-full',
        className,
      )}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      )}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'
