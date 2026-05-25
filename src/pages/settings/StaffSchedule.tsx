import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { NavLink } from 'react-router-dom'
import { DashboardLayout } from '@/layouts/DashboardLayout'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { User } from '@/types'
import toast from 'react-hot-toast'

const SHIFT_TYPES = [
  { value: 'morning',    label: 'Morning',    hours: '06:00–14:00', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'afternoon',  label: 'Afternoon',  hours: '14:00–22:00', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'night',      label: 'Night',      hours: '22:00–06:00', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  { value: 'regular',    label: 'Regular',    hours: '08:00–16:00', color: 'bg-green-100 text-green-800 border-green-200' },
  { value: 'off',        label: 'Day Off',    hours: '—',           color: 'bg-gray-100 text-gray-500 border-gray-200' },
] as const

type ShiftType = typeof SHIFT_TYPES[number]['value']

const SHIFT_DEFAULTS: Record<ShiftType, { start: string; end: string }> = {
  morning:   { start: '06:00', end: '14:00' },
  afternoon: { start: '14:00', end: '22:00' },
  night:     { start: '22:00', end: '06:00' },
  regular:   { start: '08:00', end: '16:00' },
  off:       { start: '00:00', end: '00:00' },
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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
  id: string
  user_id: string
  shift_date: string
  start_time: string
  end_time: string
  shift_type: ShiftType
  notes: string | null
}

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function toDateStr(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatWeekRange(start: Date): string {
  const end = addDays(start, 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function shiftInfo(type: ShiftType) {
  return SHIFT_TYPES.find((s) => s.value === type) ?? SHIFT_TYPES[3]
}

export default function StaffSchedule() {
  const { tenant } = useAuthStore()
  const qc = useQueryClient()

  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [modal, setModal] = useState<{ user: User; date: string; existing: Shift | null } | null>(null)
  const [form, setForm] = useState<{ shift_type: ShiftType; start_time: string; end_time: string; notes: string }>({
    shift_type: 'regular', start_time: '08:00', end_time: '16:00', notes: '',
  })
  const [saving, setSaving] = useState(false)

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))

  const { data: staff = [], isLoading: staffLoading } = useQuery<User[]>({
    queryKey: ['staff', tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .eq('is_active', true)
        .order('full_name')
      if (error) throw error
      return data as User[]
    },
    enabled: !!tenant,
  })

  const { data: shifts = [], isLoading: shiftsLoading } = useQuery<Shift[]>({
    queryKey: ['shifts', tenant?.id, toDateStr(weekStart)],
    queryFn: async () => {
      const startStr = toDateStr(weekStart)
      const endStr   = toDateStr(addDays(weekStart, 6))
      const { data, error } = await supabase
        .from('staff_shifts')
        .select('*')
        .eq('tenant_id', tenant!.id)
        .gte('shift_date', startStr)
        .lte('shift_date', endStr)
      if (error) throw error
      return data as Shift[]
    },
    enabled: !!tenant,
  })

  const deleteShift = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff_shifts').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['shifts', tenant?.id] })
      toast.success('Shift removed')
      setModal(null)
    },
    onError: (err: unknown) => toast.error((err as { message?: string })?.message ?? 'Failed to remove shift'),
  })

  function openModal(user: User, date: string) {
    const existing = shifts.find((s) => s.user_id === user.id && s.shift_date === date) ?? null
    setForm(
      existing
        ? { shift_type: existing.shift_type, start_time: existing.start_time.slice(0, 5), end_time: existing.end_time.slice(0, 5), notes: existing.notes ?? '' }
        : { shift_type: 'regular', start_time: '08:00', end_time: '16:00', notes: '' }
    )
    setModal({ user, date, existing })
  }

  function handleShiftTypeChange(type: ShiftType) {
    const defaults = SHIFT_DEFAULTS[type]
    setForm((p) => ({ ...p, shift_type: type, start_time: defaults.start, end_time: defaults.end }))
  }

  async function handleSave() {
    if (!modal || !tenant) return
    setSaving(true)
    try {
      const payload = {
        tenant_id:  tenant.id,
        user_id:    modal.user.id,
        shift_date: modal.date,
        shift_type: form.shift_type,
        start_time: form.start_time,
        end_time:   form.end_time,
        notes:      form.notes || null,
      }

      let error
      if (modal.existing) {
        ;({ error } = await supabase.from('staff_shifts').update(payload).eq('id', modal.existing.id))
      } else {
        ;({ error } = await supabase.from('staff_shifts').insert(payload))
      }
      if (error) throw error

      toast.success(modal.existing ? 'Shift updated' : 'Shift added')
      qc.invalidateQueries({ queryKey: ['shifts', tenant?.id] })
      setModal(null)
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message ?? 'Failed to save shift'
      toast.error(msg)
      console.error('Shift save error:', err)
    } finally {
      setSaving(false)
    }
  }

  const isLoading = staffLoading || shiftsLoading

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

        {/* Week navigator */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="p-2 rounded-lg border border-mid hover:bg-gray-100 text-subtext hover:text-body transition-colors text-sm"
          >
            ← Prev
          </button>
          <div className="flex-1 text-center">
            <p className="text-sm font-semibold text-body">{formatWeekRange(weekStart)}</p>
          </div>
          <button
            onClick={() => setWeekStart(getWeekStart(new Date()))}
            className="px-3 py-1.5 text-xs rounded-lg border border-mid hover:bg-gray-100 text-subtext transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="p-2 rounded-lg border border-mid hover:bg-gray-100 text-subtext hover:text-body transition-colors text-sm"
          >
            Next →
          </button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><LoadingSpinner /></div>
        ) : staff.length === 0 ? (
          <div className="text-center py-12 text-subtext text-sm">No active staff found. Invite staff from the Users tab first.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-mid">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-mid">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-subtext uppercase tracking-wide w-40 sticky left-0 bg-gray-50 z-10">
                    Staff Member
                  </th>
                  {weekDates.map((date, i) => {
                    const isToday = toDateStr(date) === toDateStr(new Date())
                    return (
                      <th key={i} className={`text-center px-2 py-3 text-xs font-semibold uppercase tracking-wide min-w-[110px] ${isToday ? 'text-gold' : 'text-subtext'}`}>
                        <div>{DAYS[i]}</div>
                        <div className={`text-base font-bold mt-0.5 ${isToday ? 'text-gold' : 'text-body'}`}>
                          {date.getDate()}
                        </div>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-mid">
                {staff.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 sticky left-0 bg-white z-10 border-r border-mid">
                      <p className="font-medium text-body text-sm">{member.full_name}</p>
                      <p className="text-xs text-subtext capitalize">{member.role.replace('_', ' ')}</p>
                    </td>
                    {weekDates.map((date, i) => {
                      const dateStr = toDateStr(date)
                      const shift = shifts.find((s) => s.user_id === member.id && s.shift_date === dateStr)
                      const info = shift ? shiftInfo(shift.shift_type) : null
                      return (
                        <td key={i} className="px-2 py-2 text-center align-middle">
                          <button
                            onClick={() => openModal(member, dateStr)}
                            className={`w-full rounded-lg border px-2 py-1.5 text-xs font-medium transition-all hover:opacity-80 hover:shadow-sm ${
                              info ? info.color : 'border-dashed border-gray-300 text-gray-400 hover:border-gray-400 hover:text-gray-500'
                            }`}
                          >
                            {info ? (
                              <>
                                <div className="font-semibold">{info.label}</div>
                                <div className="text-[10px] opacity-75">{info.hours}</div>
                              </>
                            ) : (
                              <span>+ Add</span>
                            )}
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap gap-2">
          {SHIFT_TYPES.map((s) => (
            <span key={s.value} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${s.color}`}>
              {s.label} {s.hours !== '—' && <span className="opacity-60">{s.hours}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* ── Shift Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-body">{modal.existing ? 'Edit Shift' : 'Add Shift'}</h2>
                <p className="text-sm text-subtext mt-0.5">
                  {modal.user.full_name} — {new Date(modal.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setModal(null)} className="text-subtext hover:text-body text-xl leading-none">&times;</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-body mb-1">Shift Type</label>
                <div className="grid grid-cols-2 gap-2">
                  {SHIFT_TYPES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => handleShiftTypeChange(s.value)}
                      className={`rounded-lg border px-3 py-2 text-xs font-medium text-left transition-all ${
                        form.shift_type === s.value
                          ? `${s.color} ring-2 ring-offset-1 ring-current`
                          : 'border-mid text-subtext hover:border-gray-400'
                      }`}
                    >
                      <div className="font-semibold">{s.label}</div>
                      <div className="opacity-75">{s.hours}</div>
                    </button>
                  ))}
                </div>
              </div>

              {form.shift_type !== 'off' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-body mb-1">Start Time</label>
                    <input
                      type="time"
                      value={form.start_time}
                      onChange={(e) => setForm((p) => ({ ...p, start_time: e.target.value }))}
                      className="w-full border border-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-body mb-1">End Time</label>
                    <input
                      type="time"
                      value={form.end_time}
                      onChange={(e) => setForm((p) => ({ ...p, end_time: e.target.value }))}
                      className="w-full border border-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-body mb-1">Notes (optional)</label>
                <input
                  type="text"
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Cover front desk from 2pm"
                  className="w-full border border-mid rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              {modal.existing && (
                <button
                  onClick={() => {
                    if (window.confirm('Remove this shift?')) deleteShift.mutate(modal.existing!.id)
                  }}
                  className="px-3 py-2 text-sm border border-red-200 text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  Remove
                </button>
              )}
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2 text-sm border border-mid rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2 text-sm font-semibold bg-gold text-white rounded-lg hover:bg-yellow-600 transition-colors disabled:opacity-60"
              >
                {saving ? 'Saving…' : modal.existing ? 'Update' : 'Add Shift'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
