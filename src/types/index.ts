export * from './database'

export interface AuthUser {
  id: string
  email: string
  profile: import('./database').User
  tenant: import('./database').Tenant
}

export interface SelectOption {
  value: string
  label: string
}

export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

export interface BookingFilters {
  status?: import('./database').BookingStatus
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface RoomFilters {
  status?: import('./database').RoomStatus
  floor?: number
  roomTypeId?: string
}

export interface DashboardStats {
  totalRooms: number
  occupiedRooms: number
  availableRooms: number
  occupancyRate: number
  todayCheckIns: number
  todayCheckOuts: number
  pendingHousekeeping: number
  revenueToday: number
  revenueThisMonth: number
}
