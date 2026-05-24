import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavLink, Link } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { Badge } from '@/components/ui/Badge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'
import { USER_ROLE_LABELS } from '@/lib/constants'
import type { User } from '@/types'
import toast from 'react-hot-toast'

const ROLES = [
  { value: 'admin',       label: 'Admin',      desc: 'Full access — settings, billing, all modules' },
  { value: 'manager',     label: 'Manager',    desc: 'All modules except settings & billing' },
  { value: 'front_desk',  label: 'Front Desk', desc: 'Bookings, rooms, guests, invoices, messaging' },
  { value: 'housekeeping',label: 'Housekeeping',desc: 'Dashboard and housekeeping module only' },
] as const

type RoleValue = typeof ROLES[number]['value']

const ROLE_COLORS: Record<RoleValue, string> = {
  admin:        'bg-navy text-white',
  manager:      'bg-blue-100 text-blue-700',
  front_desk:   'bg-amber-100 text-amber-800',
  housekeeping: 'bg-green-100 text-green-700',
}

const SETTINGS_NAV = [
  { to: '/settings',            label: 'Hotel' },
  { to: '/settings/users',      label: 'Users' },
  { to: '/settings/staff-schedule', label: 'Schedule' },
  { to: '/settings/billing',    label: 'Billing' },
  { to: '/settings/packages',   label: 'Packages' },
  { to: '/settings/promotions', label: 'Promotions' },
  { to: '/settings/vouchers',   label: 'Vouchers' },
]

interface InviteForm { email: string; full_name: string; role: RoleValue }
interface EditForm   { full_name: string; role: RoleValue }

export default function UserManagement() {
  const { tenant, user: me } = useAuthStore()
  const qc = useQueryClient()

  const [showInvite, setShowInvite] = useState(false)
  const [editUser,   setEditUser]   = useState<User | null>(null)
  const [invite,     setInvite]     = useState<InviteForm>({ email: '', full_name: '', role: 'front_desk' })
  const [edit,       setEdit]       = useState<EditForm>({ full_name: '', role: 'front_desk' })
  const [inviting,   setInviting]   = useState(false)
  const [saving,     setSaving]     = useState(false)

  const { data: users = [], isLoading } = useQuery<User[]>({
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

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from('users').update({ is_active }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users', tenant?.id] })
      toast.success('Staff status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  async function handleInvite() {
    if (!invite.email || !invite.full_name || !invite.role) {
      toast.error('All fields are required')
      return
    }
    setInviting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) throw new Error('Not authenticated')

      const res = await fetch('/api/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(invite),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Invite failed')

      toast.success(`Invite sent to ${invite.email}`)
      setShowInvite(false)
      setInvite({ email: '', full_name: '', role: 'front_desk' })
      qc.invalidateQueries({ queryKey: ['users', tenant?.id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invite failed')
    } finally {
      setInviting(false)
    }
  }

  function openEdit(u: User) {
    setEdit({ full_name: u.full_name, role: u.role as RoleValue })
    setEditUser(u)
  }

  async function handleEdit() {
    if (!editUser) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: edit.full_name.trim(), role: edit.role })
        .eq('id', editUser.id)
      if (error) throw error
      toast.success('Staff member updated')
      setEditUser(null)
      qc.invalidateQueries({ queryKey: ['users', tenant?.id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <h1 className="text-xl font-bold text-body">Settings</h1>

        {/* Sub-nav */}
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

        {/* Header row */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-subtext">Manage staff access and roles for your hotel.</p>
          <button
            onClick={() => setShowInvite(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-gold text-white rounded-lg hover:bg-yellow-600 transition-colors"
          >
            <span className="text-base leading-none">+</span> Invite Staff
          </button>
        </div>

        {/* Staff table */}
        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : users.length === 0 ? (
          <div className="text-center py-12 text-subtext text-sm">No staff members yet. Invite your first team member above.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-mid">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-mid">
                <tr>
                  {['Name', 'Email', 'Role', 'Status', 'Joined', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-subtext uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <Link
                        to={`/settings/users/${u.id}`}
                        className="font-medium text-body hover:text-gold hover:underline underline-offset-2 transition-colors"
                      >
                        {u.full_name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-subtext">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role as RoleValue] ?? 'bg-gray-100 text-gray-700'}`}>
                        {USER_ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        label={u.is_active ? 'Active' : 'Inactive'}
                        className={u.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}
                      />
                    </td>
                    <td className="px-4 py-3 text-xs text-subtext whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => openEdit(u)}
                          className="text-xs px-3 py-1 rounded-lg border border-mid hover:bg-gray-100 text-body transition-colors"
                        >
                          Edit
                        </button>
                        {u.id !== me?.id && !(me?.role === 'manager' && u.role === 'admin') && (
                          <button
                            onClick={() => {
                              if (window.confirm(`${u.is_active ? 'Deactivate' : 'Activate'} ${u.full_name}?`)) {
                                toggleActive.mutate({ id: u.id, is_active: !u.is_active })
                              }
                            }}
                            className={`text-xs px-3 py-1 rounded-lg border transition-colors ${
                              u.is_active
                                ? 'border-red-200 text-red-600 hover:bg-red-50'
                                : 'border-green-200 text-green-600 hover:bg-green-50'
                            }`}
                          >
                            {u.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Role legend */}
        <div className="rounded-xl border border-mid p-4 bg-gray-50">
          <p className="text-xs font-semibold text-subtext uppercase tracking-wide mb-3">Role Access Levels</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ROLES.map((r) => (
              <div key={r.value} className="flex items-start gap-2">
                <span className={`mt-0.5 inline-flex px-2 py-0.5 rounded-full text-xs font-semibold shrink-0 ${ROLE_COLORS[r.value]}`}>
                  {r.label}
                </span>
                <span className="text-xs text-subtext">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Invite Modal ── */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-body">Invite Staff Member</h2>
              <button onClick={() => setShowInvite(false)} className="text-subtext hover:text-body text-xl leading-none">&times;</button>
            </div>
            <p className="text-sm text-subtext">They'll receive an email to set their password and access the PMS.</p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-body mb-1">Full Name</label>
                <input
                  type="text"
                  value={invite.full_name}
                  onChange={(e) => setInvite((p) => ({ ...p, full_name: e.target.value }))}
                  placeholder="Jane Smith"
                  className="w-full border border-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1">Email Address</label>
                <input
                  type="email"
                  value={invite.email}
                  onChange={(e) => setInvite((p) => ({ ...p, email: e.target.value }))}
                  placeholder="jane@yourhotel.com"
                  className="w-full border border-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1">Role</label>
                <select
                  value={invite.role}
                  onChange={(e) => setInvite((p) => ({ ...p, role: e.target.value as RoleValue }))}
                  className="w-full border border-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowInvite(false)}
                className="flex-1 py-2 text-sm border border-mid rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleInvite}
                disabled={inviting}
                className="flex-1 py-2 text-sm font-semibold bg-gold text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-60"
              >
                {inviting ? 'Sending…' : 'Send Invite'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-body">Edit Staff Member</h2>
              <button onClick={() => setEditUser(null)} className="text-subtext hover:text-body text-xl leading-none">&times;</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-body mb-1">Full Name</label>
                <input
                  type="text"
                  value={edit.full_name}
                  onChange={(e) => setEdit((p) => ({ ...p, full_name: e.target.value }))}
                  className="w-full border border-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-body mb-1">Role</label>
                <select
                  value={edit.role}
                  onChange={(e) => setEdit((p) => ({ ...p, role: e.target.value as RoleValue }))}
                  className="w-full border border-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                >
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-subtext">Email address cannot be changed. Contact Supabase support if needed.</p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditUser(null)}
                className="flex-1 py-2 text-sm border border-mid rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleEdit}
                disabled={saving}
                className="flex-1 py-2 text-sm font-semibold bg-gold text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
