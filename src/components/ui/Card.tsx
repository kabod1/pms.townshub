import type { ReactNode } from 'react'
import { classNames } from '@/lib/utils'

interface CardProps {
  children: ReactNode
  className?: string
  padding?: boolean
}

export function Card({ children, className, padding = true }: CardProps) {
  return (
    <div
      className={classNames(
        'rounded-xl bg-white shadow-sm ring-1 ring-mid',
        padding && 'p-5',
        className,
      )}
    >
      {children}
    </div>
  )
}

interface StatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: { value: number; positive: boolean }
  color?: 'navy' | 'gold' | 'green' | 'red' | 'blue'
}

const colorMap = {
  navy: 'bg-navy text-white',
  gold: 'bg-gold text-white',
  green: 'bg-green-700 text-white',
  red: 'bg-red-700 text-white',
  blue: 'bg-blue text-white',
}

export function StatCard({ title, value, subtitle, icon, trend, color = 'navy' }: StatCardProps) {
  return (
    <Card className="flex items-start gap-4">
      {icon && (
        <div className={classNames('rounded-lg p-2.5 shrink-0', colorMap[color])}>
          {icon}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-sm text-subtext truncate">{title}</p>
        <p className="mt-0.5 text-2xl font-bold text-body">{value}</p>
        {subtitle && <p className="mt-0.5 text-xs text-subtext">{subtitle}</p>}
        {trend && (
          <p className={classNames('mt-1 text-xs font-medium', trend.positive ? 'text-green-700' : 'text-red-600')}>
            {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}%
          </p>
        )}
      </div>
    </Card>
  )
}
