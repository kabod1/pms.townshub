import type { UserRole } from '@/types'

const ROLE_HIERARCHY: Record<UserRole, number> = {
  admin: 4,
  manager: 3,
  front_desk: 2,
  housekeeping: 1,
}

export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
}

export function canManageBookings(role: UserRole): boolean {
  return hasRole(role, 'front_desk')
}

export function canManageRooms(role: UserRole): boolean {
  return hasRole(role, 'manager')
}

export function canManageUsers(role: UserRole): boolean {
  return role === 'admin'
}

export function canViewReports(role: UserRole): boolean {
  return hasRole(role, 'front_desk')
}

export function canManageSettings(role: UserRole): boolean {
  return hasRole(role, 'manager')
}

export function canManageBilling(role: UserRole): boolean {
  return role === 'admin'
}

export function canManageHousekeeping(role: UserRole): boolean {
  return hasRole(role, 'housekeeping')
}

export function canManageInvoices(role: UserRole): boolean {
  return hasRole(role, 'front_desk')
}
