import { isLeaveType, type LeaveGrant } from '../domain/leave'
import { isCalendarDate } from '../domain/calendarDate'
import type { LeaveUsage } from '../domain/leaveUsage'
import type { Outing } from '../domain/outing'
import { initialAppState, type AppState } from './appReducer'

export const APP_STORAGE_KEY = 'airforce-calendar:data'

export type StoredAppData = {
  version: 3
  leaveGrants: LeaveGrant[]
  leaveUsages: LeaveUsage[]
  outings: Outing[]
}

type ParsedStoredAppData = {
  version?: number
  leaveGrants?: unknown
  leaveUsages?: unknown
  outings?: unknown
}

function isLeaveGrant(value: unknown): value is LeaveGrant {
  if (!value || typeof value !== 'object') {
    return false
  }

  const leaveGrant = value as Record<string, unknown>

  return (
    typeof leaveGrant.id === 'string' &&
    isLeaveType(leaveGrant.type) &&
    typeof leaveGrant.days === 'number' &&
    Number.isInteger(leaveGrant.days) &&
    leaveGrant.days > 0 &&
    typeof leaveGrant.acquiredDate === 'string' &&
    typeof leaveGrant.reason === 'string' &&
    typeof leaveGrant.memo === 'string' &&
    typeof leaveGrant.createdAt === 'string' &&
    typeof leaveGrant.updatedAt === 'string'
  )
}

function isLeaveUsage(value: unknown): value is LeaveUsage {
  if (!value || typeof value !== 'object') return false

  const usage = value as Record<string, unknown>

  return (
    typeof usage.id === 'string' &&
    typeof usage.leaveGrantId === 'string' &&
    isCalendarDate(usage.startDate) &&
    isCalendarDate(usage.endDate) &&
    usage.startDate <= usage.endDate &&
    typeof usage.canceled === 'boolean' &&
    (usage.canceledAt === null || typeof usage.canceledAt === 'string') &&
    typeof usage.createdAt === 'string' &&
    typeof usage.updatedAt === 'string'
  )
}

function isOuting(value: unknown): value is Outing {
  if (!value || typeof value !== 'object') return false

  const outing = value as Record<string, unknown>

  return (
    typeof outing.id === 'string' &&
    isCalendarDate(outing.date) &&
    typeof outing.reason === 'string' &&
    outing.reason.trim().length > 0 &&
    typeof outing.canceled === 'boolean' &&
    (outing.canceledAt === null || typeof outing.canceledAt === 'string') &&
    typeof outing.createdAt === 'string' &&
    typeof outing.updatedAt === 'string'
  )
}

export function loadAppState(): AppState {
  try {
    const serializedData = localStorage.getItem(APP_STORAGE_KEY)

    if (!serializedData) {
      return initialAppState
    }

    const storedData = JSON.parse(serializedData) as ParsedStoredAppData

    if (
      !Array.isArray(storedData.leaveGrants) ||
      !storedData.leaveGrants.every(isLeaveGrant)
    ) {
      return initialAppState
    }

    const leaveGrants = storedData.leaveGrants

    if (storedData.version === 1) {
      return { leaveGrants, leaveUsages: [], outings: [] }
    }

    if (
      (storedData.version !== 2 && storedData.version !== 3) ||
      !Array.isArray(storedData.leaveUsages) ||
      !storedData.leaveUsages.every(isLeaveUsage)
    ) {
      return initialAppState
    }

    const leaveUsages = storedData.leaveUsages

    if (
      leaveUsages.some(
        (usage) =>
          !leaveGrants.some(
            (leaveGrant) => leaveGrant.id === usage.leaveGrantId,
          ),
      )
    ) {
      return initialAppState
    }

    if (storedData.version === 2) {
      return { leaveGrants, leaveUsages, outings: [] }
    }

    if (
      !Array.isArray(storedData.outings) ||
      !storedData.outings.every(isOuting)
    ) {
      return initialAppState
    }

    return {
      leaveGrants,
      leaveUsages,
      outings: storedData.outings,
    }
  } catch {
    return initialAppState
  }
}

export function saveAppState(state: AppState) {
  const storedData: StoredAppData = {
    version: 3,
    leaveGrants: state.leaveGrants,
    leaveUsages: state.leaveUsages,
    outings: state.outings,
  }

  localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(storedData))
}

export function getLocalDataForMigration(): StoredAppData | null {
  try {
    const raw = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? 'null') as
      | ParsedStoredAppData
      | null
    if (raw?.version !== 3) return null
    const state = loadAppState()
    if (
      state.leaveGrants.length === 0 &&
      state.leaveUsages.length === 0 &&
      state.outings.length === 0
    ) return null
    return { version: 3, ...state }
  } catch {
    return null
  }
}

export function clearLocalAppData() {
  localStorage.removeItem(APP_STORAGE_KEY)
}
