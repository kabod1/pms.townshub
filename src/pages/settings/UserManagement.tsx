import { useQuery } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Badge } from '@/components/ui/Badge'
import { Table } from '@/components/ui/Table'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'
import { USER_ROLE_LABELS } from '@/lib/constants'
import type { User } from '@/types'

const ROLE_COLORS = {
  admin: 'bg-navy text-white',
  manager: 'bg-blue-100 text-blue-700',
  front_desk: 'bg-gold/20 text-yellow-800',
  housekeeping: 'bg-green-100 text-green-700',
}

export default function UserManagement() {
  const { tenant } = useAuthStore()

  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ['users', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .order('created_at')
      if (error) throw error
      return data as User[]
    },
    enabled: !!tenant,
  })

  const columns = [
    {
      key: 'name',
      header: 'Name',
      render: (u: User) => <span className="font-medium">{u.full_name}</span>,
    },
    { key: 'email', header: 'Email', render: (u: User) => <span className="text-sm">{u.email}</span> },
    {
      key: 'role',
      header: 'Role',
      render: (u: User) => (
        <Badge label={USER_ROLE_LABELS[u.role]} className={ROLE_COLORS[u.role]} />
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (u: User) => (
        <Badge
          label={u.is_active ? 'Active' : 'Inactive'}
          className={u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
        />
      ),
    },
    {
      key: 'joined',
      header: 'Joined',
      render: (u: User) => <span className="text-xs text-subtext">{formatDate(u.created_at)}</span>,
    },
  ]

const SETTINGS_NAV = [
  { to: '/settings', label: 'Hotel' },
  { to: '/settings/users', label: 'Users' },
  { to: '/settings/billing', label: 'Billing' },
  { to: '/settings/packages', label: 'Packages' },
  { to: '/settings/promotions', label: 'Promotions' },
  { to: '/settings/vouchers', label: 'Vouchers' },
]

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-body">Settings</h1>

        <div className="flex gap-1 border-b border-mid overflow-x-auto">
          {SETTINGS_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `shrink-0 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  isActive ? 'border-gold text-gold' : 'border-transparent text-subtext hover:text-body'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>

        <p className="text-sm text-subtext">Manage staff access and roles for your hotel.</p>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : (
          <Table
            columns={columns}
            data={users ?? []}
            keyExtractor={(u) => u.id}
            emptyMessage="No users found"
          />
        )}
      </div>
    </DashboardLayout>
  )
}
