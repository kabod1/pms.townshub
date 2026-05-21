import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Shield } from 'lucide-react'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { AuditLog } from '@/types'

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700',
  update: 'bg-blue-100 text-blue-700',
  delete: 'bg-red-100 text-red-700',
  login: 'bg-purple-100 text-purple-700',
  logout: 'bg-gray-100 text-gray-600',
}

function useAuditLogs(search: string) {
  const { tenant } = useAuthStore()
  return useQuery({
    queryKey: ['audit-logs', tenant?.id, search],
    queryFn: async () => {
      let q = supabase
        .from('audit_log')
        .select('*, user:users(full_name,email)')
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false })
        .limit(200)
      if (search) {
        q = q.or(`action.ilike.%${search}%,table_name.ilike.%${search}%`)
      }
      const { data, error } = await q
      if (error) throw error
      return data as AuditLog[]
    },
    enabled: !!tenant,
  })
}

export default function AuditLogPage() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const { data: logs = [], isLoading } = useAuditLogs(debouncedSearch)

  function handleSearch(value: string) {
    setSearch(value)
    clearTimeout((handleSearch as unknown as { _t: ReturnType<typeof setTimeout> })._t)
    ;(handleSearch as unknown as { _t: ReturnType<typeof setTimeout> })._t = setTimeout(() => setDebouncedSearch(value), 400)
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-body">Audit Log</h1>
            <p className="text-sm text-subtext">Full activity trail for all staff actions</p>
          </div>
        </div>

        <div className="max-w-sm">
          <Input
            placeholder="Search by action or table…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : logs.length === 0 ? (
          <EmptyState icon={<Shield size={32} />} title="No audit logs" description="Staff actions will be recorded here." />
        ) : (
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-mid overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-mid bg-light">
                  <th className="text-left py-2.5 px-4 text-subtext font-medium">Timestamp</th>
                  <th className="text-left py-2.5 px-4 text-subtext font-medium">User</th>
                  <th className="text-left py-2.5 px-4 text-subtext font-medium">Action</th>
                  <th className="text-left py-2.5 px-4 text-subtext font-medium">Table</th>
                  <th className="text-left py-2.5 px-4 text-subtext font-medium">Record</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {logs.map((log) => {
                  const actor = log.user as { full_name: string; email: string } | null
                  const color = ACTION_COLORS[log.action.toLowerCase().split(' ')[0]] ?? 'bg-gray-100 text-gray-600'
                  return (
                    <tr key={log.id} className="hover:bg-light">
                      <td className="py-2.5 px-4 text-xs text-subtext font-mono whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4">
                        <p className="text-body font-medium">{actor?.full_name ?? '—'}</p>
                        {actor?.email && <p className="text-xs text-subtext">{actor.email}</p>}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge label={log.action} className={`${color} text-xs`} />
                      </td>
                      <td className="py-2.5 px-4 text-body font-mono text-xs">{log.table_name ?? '—'}</td>
                      <td className="py-2.5 px-4 text-subtext font-mono text-xs truncate max-w-[120px]">{log.record_id ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-mid text-xs text-subtext">
              Showing last {logs.length} records
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  )
}
