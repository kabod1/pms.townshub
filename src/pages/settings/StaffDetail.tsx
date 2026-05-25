import { useState } from 'react'
import { useParams, useNavigate, NavLink } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Badge } from '@/components/ui/Badge'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { formatDate } from '@/lib/utils'
import { USER_ROLE_LABELS } from '@/lib/constants'
import type { User } from '@/types'
import { ArrowLeft, Mail, Calendar, Shield, Clock } from 'lucide-react'
import toast from 'react-hot-toast'

const ROLES = [
  { value: 'admin',        label: 'Admin',       desc: 'Full access — settings, billing, all modules' },
  { value: 'manager',      label: 'Manager',     desc: 'All modules except settings & billing' },
  { value: 'front_desk',   label: 'Front Desk',  desc: 'Bookings, rooms, guests, invoices, messaging' },
  { value: 'housekeeping', label: 'Housekeeping', desc: 'Dashboard and housekeeping module only' },
] as const
type RoleValue = typeof ROLES[number]['value']

const ROLE_COLORS: Record<RoleValue, string> = {
  admin:        'bg-navy text-white',
  manager:      'bg-blue-100 text-blue-700',
  front_desk:   'bg-amber-100 text-amber-800',
  housekeeping: 'bg-green-100 text-green-700',
}

const SHIFT_TYPE_COLORS: Record<string, string> = {
  morning:   'bg-amber-100 text-amber-800',
  afternoon: 'bg-blue-100 text-blue-800',
  night:     'bg-indigo-100 text-indigo-800',
  regular:   'bg-green-100 text-green-800',
  off:       'bg-gray-100 text-gray-500',
}

const SETTINGS_NAV = [
  { to: '/settings',                label: 'Hotel' },
  { to: '/settings/users',          label: 'Users' },
  { to: '/settings/staff-schedule', label: 'Schedule' },
  { to: '/settings/billing',        label: 'Billing' },
  { to: '/settings/packages',       label: 'Packages' },
  { to: '/settings/promotions',     label: 'Promotions' },
  { to: '/settings/vouchers',       label: 'Vouchers' },
  { to: '/settings/channels',       label: 'Channels' },
]

interface Shift {
  id: string; shift_date: string; start_time: string; end_time: string
  shift_type: string; notes: string | null
}

function initials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
}

export default function StaffDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: me, tenant } = useAuthStore()
  const qc = useQueryClient()

  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ full_name: '', role: 'front_desk' as RoleValue })
  const [saving, setSaving] = useState(false)

  const { data: staff, isLoading } = useQuery<User>({
    queryKey: ['staff-member', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as User
    },
    enabled: !!id,
  })

  const { data: shifts = [] } = useQuery<Shift[]>({
    queryKey: ['staff-shifts', id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0]
      const inThirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
      const { data, error } = await supabase
        .from('staff_shifts')
        .select('id, shift_date, start_time, end_time, shift_type, notes')
        .eq('user_id', id!)
        .gte('shift_date', today)
        .lte('shift_date', inThirtyDays)
        .order('shift_date')
      if (error) throw error
      return data as Shift[]
    },
    enabled: !!id,
  })

  const toggleActive = useMutation({
    mutationFn: async (is_active: boolean) => {
      const { error } = await supabase.from('users').update({ is_active }).eq('id', id!)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['staff-member', id] })
      qc.invalidateQueries({ queryKey: ['users', tenant?.id] })
      toast.success('Status updated')
    },
    onError: () => toast.error('Failed to update status'),
  })

  async function handleSave() {
    if (!form.full_name.trim()) { toast.error('Name is required'); return }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .update({ full_name: form.full_name.trim(), role: form.role })
        .eq('id', id!)
      if (error) throw error
      toast.success('Profile updated')
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['staff-member', id] })
      qc.invalidateQueries({ queryKey: ['users', tenant?.id] })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  function startEdit() {
    if (!staff) return
    setForm({ full_name: staff.full_name, role: staff.role as RoleValue })
    setEditing(true)
  }

  const isSelf = me?.id === id
  const canDeactivate = !isSelf && !(me?.role === 'manager' && staff?.role === 'admin')
  const canEdit = me?.role === 'admin' || (me?.role === 'manager' && staff?.role !== 'admin')

  if (isLoading) return (
    <DashboardLayout>
      <div className="flex justify-center py-20"><LoadingSpinner /></div>
    </DashboardLayout>
  )

  if (!staff) return (
    <DashboardLayout>
      <p className="text-sm text-red-600 p-6">Staff member not found.</p>
    </DashboardLayout>
  )

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

        {/* Back */}
        <button
          onClick={() => navigate('/settings/users')}
          className="flex items-center gap-1.5 text-sm text-subtext hover:text-body transition-colors"
        >
          <ArrowLeft size={15} /> Back to Users
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ── Profile card ── */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white rounded-xl border border-mid p-6 text-center">
              <div className="w-20 h-20 rounded-full bg-navy flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
                {initials(staff.full_name)}
              </div>
              <h2 className="text-lg font-bold text-body">{staff.full_name}</h2>
              <div className="flex justify-center mt-1.5">
                <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[staff.role as RoleValue] ?? 'bg-gray-100 text-gray-700'}`}>
                  {USER_ROLE_LABELS[staff.role] ?? staff.role}
                </span>
              </div>
              <Badge
                label={staff.is_active ? 'Active' : 'Inactive'}
                className={`mt-2 ${staff.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
              />
            </div>

            {/* Info */}
            <div className="bg-white rounded-xl border border-mid p-5 space-y-4">
              <div className="flex items-start gap-3">
                <Mail size={15} className="text-subtext mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-subtext">Email</p>
                  <p className="text-sm text-body break-all">{staff.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar size={15} className="text-subtext mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-subtext">Joined</p>
                  <p className="text-sm text-body">{formatDate(staff.created_at)}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield size={15} className="text-subtext mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-subtext">Role</p>
                  <p className="text-sm text-body">{ROLES.find((r) => r.value === staff.role)?.desc ?? staff.role}</p>
                </div>
              </div>
            </div>

            {/* Actions */}
            {!isSelf && (
              <div className="bg-white rounded-xl border border-mid p-5 space-y-2">
                <p className="text-xs font-semibold text-subtext uppercase tracking-wide mb-3">Actions</p>
                {canEdit && (
                  <button
                    onClick={startEdit}
                    className="w-full text-sm py-2 rounded-lg border border-mid hover:bg-gray-50 text-body transition-colors"
                  >
                    Edit Profile
                  </button>
                )}
                {canDeactivate && (
                  <button
                    onClick={() => {
                      if (window.confirm(`${staff.is_active ? 'Deactivate' : 'Activate'} ${staff.full_name}?`)) {
                        toggleActive.mutate(!staff.is_active)
                      }
                    }}
                    className={`w-full text-sm py-2 rounded-lg border transition-colors ${
                      staff.is_active
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-green-200 text-green-600 hover:bg-green-50'
                    }`}
                  >
                    {staff.is_active ? 'Deactivate Account' : 'Activate Account'}
                  </button>
                )}
                {!canDeactivate && !isSelf && (
                  <p className="text-xs text-subtext text-center py-1">
                    Only admins can deactivate other admins.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Right column ── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Edit form */}
            {editing && (
              <div className="bg-white rounded-xl border border-gold/40 p-6 space-y-4">
                <h3 className="font-semibold text-body">Edit Profile</h3>
                <div>
                  <label className="block text-xs font-medium text-body mb-1">Full Name</label>
                  <input
                    type="text"
                    value={form.full_name}
                    onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                    className="w-full border border-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-body mb-1">Role</label>
                  <select
                    value={form.role}
                    onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as RoleValue }))}
                    className="w-full border border-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex-1 py-2 text-sm border border-mid rounded-lg hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving} className="flex-1 py-2 text-sm font-semibold bg-gold text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-60">
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            )}

            {/* Upcoming shifts */}
            <div className="bg-white rounded-xl border border-mid overflow-hidden">
              <div className="px-5 py-4 border-b border-mid flex items-center gap-2">
                <Clock size={15} className="text-subtext" />
                <h3 className="font-semibold text-body text-sm">Upcoming Shifts — Next 30 Days</h3>
              </div>
              {shifts.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-subtext">
                  No upcoming shifts scheduled.{' '}
                  <button
                    onClick={() => navigate('/settings/staff-schedule')}
                    className="text-gold hover:underline"
                  >
                    Add shifts in the Schedule tab.
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-mid">
                  {shifts.map((s) => {
                    const date = new Date(s.shift_date + 'T12:00:00')
                    return (
                      <div key={s.id} className="px-5 py-3 flex items-center gap-4">
                        <div className="w-12 text-center shrink-0">
                          <p className="text-xs text-subtext uppercase">{date.toLocaleDateString('en', { weekday: 'short' })}</p>
                          <p className="text-lg font-bold text-body leading-tight">{date.getDate()}</p>
                          <p className="text-xs text-subtext">{date.toLocaleDateString('en', { month: 'short' })}</p>
                        </div>
                        <div className="flex-1">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold capitalize ${SHIFT_TYPE_COLORS[s.shift_type] ?? 'bg-gray-100 text-gray-700'}`}>
                            {s.shift_type}
                          </span>
                          {s.shift_type !== 'off' && (
                            <p className="text-xs text-subtext mt-0.5">
                              {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                            </p>
                          )}
                          {s.notes && <p className="text-xs text-subtext mt-0.5 italic">{s.notes}</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
