import type { AppAction, AppState } from '../store/appReducer'
import { appReducer } from '../store/appReducer'
import { saveAppState, type StoredAppData } from '../store/appStorage'
import {
  getServerErrorMessage,
  isAppSnapshot,
  toServerErrorCode,
  type AppSnapshot,
  type MutationResult,
} from './appSnapshot'
import { supabase } from './supabaseClient'

export type AppRepository = {
  loadSnapshot: () => Promise<AppSnapshot>
  mutate: (action: AppAction, state: AppState) => Promise<MutationResult>
  migrateLocalData: (data: unknown) => Promise<MutationResult>
}

function actionToServerRequest(action: AppAction, state: AppState) {
  const requestId = crypto.randomUUID()
  switch (action.type) {
    case 'leaveGrant/added':
      return { requestId, operation: 'leaveGrant/create', payload: action.payload }
    case 'leaveGrant/updated':
      return {
        requestId,
        operation: 'leaveGrant/update',
        payload: {
          ...action.payload,
          expectedRevision:
            state.leaveGrants.find((item) => item.id === action.payload.id)
              ?.revision ?? 0,
        },
      }
    case 'leaveGrant/deleted': {
      const grant = state.leaveGrants.find((item) => item.id === action.payload.id)
      return {
        requestId,
        operation: 'leaveGrant/delete',
        payload: { id: action.payload.id, expectedRevision: grant?.revision ?? 0 },
      }
    }
    case 'leaveUsage/added':
      return { requestId, operation: 'leaveUsage/create', payload: action.payload }
    case 'leaveUsage/updated':
      return {
        requestId,
        operation: 'leaveUsage/update',
        payload: {
          ...action.payload,
          expectedRevision:
            state.leaveUsages.find((item) => item.id === action.payload.id)
              ?.revision ?? 0,
        },
      }
    case 'leaveUsage/canceled': {
      const usage = state.leaveUsages.find((item) => item.id === action.payload.id)
      return {
        requestId,
        operation: 'leaveUsage/cancel',
        payload: { id: action.payload.id, expectedRevision: usage?.revision ?? 0 },
      }
    }
    case 'outing/added':
      return { requestId, operation: 'outing/create', payload: action.payload }
    case 'outing/updated':
      return {
        requestId,
        operation: 'outing/update',
        payload: {
          ...action.payload,
          expectedRevision:
            state.outings.find((item) => item.id === action.payload.id)?.revision ?? 0,
        },
      }
    case 'outing/canceled': {
      const outing = state.outings.find((item) => item.id === action.payload.id)
      return {
        requestId,
        operation: 'outing/cancel',
        payload: { id: action.payload.id, expectedRevision: outing?.revision ?? 0 },
      }
    }
  }
}

function parseMutationResult(value: unknown): MutationResult {
  if (
    value &&
    typeof value === 'object' &&
    'ok' in value &&
    value.ok === true &&
    'snapshot' in value &&
    isAppSnapshot(value.snapshot)
  ) {
    return { ok: true, snapshot: value.snapshot }
  }
  const rawCode =
    value && typeof value === 'object' && 'code' in value ? value.code : undefined
  const code = toServerErrorCode(rawCode)
  return { ok: false, code, message: getServerErrorMessage(code) }
}

export const serverAppRepository: AppRepository = {
  async loadSnapshot() {
    if (!supabase) throw new Error('Supabase가 설정되지 않았습니다.')
    const { data, error } = await supabase.rpc('api_get_app_snapshot')
    if (error || !isAppSnapshot(data)) throw error ?? new Error('INVALID_SNAPSHOT')
    return data
  },
  async mutate(action, state) {
    if (!supabase) {
      return { ok: false, code: 'UNKNOWN_ERROR', message: 'Supabase가 설정되지 않았습니다.' }
    }
    const request = actionToServerRequest(action, state)
    const args = {
      p_request_id: request.requestId,
      p_operation: request.operation,
      p_payload: request.payload,
    }
    let { data, error } = await supabase.rpc('api_mutate_app', args)
    if (error) {
      const retry = await supabase.rpc('api_mutate_app', args)
      data = retry.data
      error = retry.error
    }
    if (error) {
      return { ok: false, code: 'NETWORK_ERROR', message: getServerErrorMessage('NETWORK_ERROR') }
    }
    return parseMutationResult(data)
  },
  async migrateLocalData(data) {
    if (!supabase) {
      return { ok: false, code: 'UNKNOWN_ERROR', message: 'Supabase가 설정되지 않았습니다.' }
    }
    const args = {
      p_request_id: crypto.randomUUID(),
      p_data: normalizeMigrationIds(data),
    }
    let response = await supabase.rpc('api_migrate_local_data', args)
    if (response.error) response = await supabase.rpc('api_migrate_local_data', args)
    if (response.error) {
      return { ok: false, code: 'NETWORK_ERROR', message: getServerErrorMessage('NETWORK_ERROR') }
    }
    return parseMutationResult(response.data)
  },
}

export const localAppRepository: AppRepository = {
  async loadSnapshot() {
    throw new Error('로컬 모드에는 서버 스냅샷이 없습니다.')
  },
  async mutate(action, state) {
    const nextState = appReducer(state, action)
    saveAppState(nextState)
    return {
      ok: true,
      snapshot: {
        ...nextState,
        account: {
          userId: 'local',
          status: 'active',
          localMigrationCompletedAt: null,
          localMigrationFingerprint: null,
        },
        syncedAt: new Date().toISOString(),
      },
    }
  },
  async migrateLocalData() {
    return { ok: false, code: 'UNKNOWN_ERROR', message: '로컬 모드에서는 이전할 수 없습니다.' }
  },
}

export type OnboardingSelection = { annual: number | null; performance: number | null }

export async function saveServerOnboarding(
  requestId: string, selection: OnboardingSelection, expectedRevisions: OnboardingSelection,
): Promise<MutationResult> {
  if (!supabase) return { ok: false, code: 'NETWORK_ERROR', message: getServerErrorMessage('NETWORK_ERROR') }
  const args = { p_request_id: requestId, p_selection: selection, p_expected_revisions: expectedRevisions }
  try {
    let response = await supabase.rpc('api_save_onboarding', args)
    if (response.error) response = await supabase.rpc('api_save_onboarding', args)
    if (!response.error) return parseMutationResult(response.data)
  } catch { /* A lost response is retried with the same request ID by the page. */ }
  return { ok: false, code: 'NETWORK_ERROR', message: getServerErrorMessage('NETWORK_ERROR') }
}

// Older local onboarding records used descriptive IDs. Keep all references intact
// while translating those records to the UUID contract during account migration.
export function normalizeMigrationIds(data: unknown): unknown {
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 3) return data
  const stored = data as StoredAppData
  const ids = new Map<string, string>()
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const idFor = (id: string) => {
    if (!ids.has(id)) ids.set(id, uuid.test(id) ? id : crypto.randomUUID())
    return ids.get(id)!
  }
  return {
    ...stored,
    leaveGrants: stored.leaveGrants.map((item) => ({ ...item, id: idFor(item.id) })),
    leaveUsages: stored.leaveUsages.map((item) => ({ ...item, id: idFor(item.id), leaveGrantId: idFor(item.leaveGrantId) })),
    outings: stored.outings.map((item) => ({ ...item, id: idFor(item.id) })),
  }
}

export type OnboardingPlanItem = { key: string; id: string | null; type: import('../domain/leave').LeaveType; days: number | null; acquiredDate?: string | null }
export type OnboardingPlan = { items: OnboardingPlanItem[]; expectedState: AppState; confirmed: boolean }

export async function saveServerOnboardingPlan(requestId: string, plan: OnboardingPlan): Promise<MutationResult> {
  if (!supabase) return { ok: false, code: 'NETWORK_ERROR', message: getServerErrorMessage('NETWORK_ERROR') }
  const args = { p_request_id: requestId, p_items: plan.items, p_expected_state: plan.expectedState, p_confirmed: plan.confirmed }
  try {
    let response = await supabase.rpc('api_save_onboarding_plan', args)
    if (response.error) response = await supabase.rpc('api_save_onboarding_plan', args)
    if (!response.error) return parseMutationResult(response.data)
  } catch { /* Reuse the page's request ID after an uncertain response. */ }
  return { ok: false, code: 'NETWORK_ERROR', message: getServerErrorMessage('NETWORK_ERROR') }
}
