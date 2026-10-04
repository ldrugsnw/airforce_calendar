import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/authContext'
import {
  loadServerCache,
  removeExpiredMigrationBackups,
  saveMigrationBackup,
  saveServerCache,
} from '../server/appCache'
import {
  localAppRepository,
  saveServerOnboarding,
  saveServerOnboardingPlan,
  type OnboardingPlan,
  type OnboardingSelection,
  serverAppRepository,
  type AppRepository,
} from '../server/appRepository'
import type { AccountSnapshot, AppSnapshot, MutationResult } from '../server/appSnapshot'
import { isServerMode } from '../server/supabaseClient'
import { appReducer, initialAppState, type AppAction, type AppState } from './appReducer'
import {
  AppRuntimeContext,
  type AppRuntimeStatus,
} from './appRuntimeContext'
import { AppDispatchContext, AppStateContext } from './appStateContext'
import {
  clearLocalAppData,
  getLocalDataForMigration,
  loadAppState,
  saveAppState,
} from './appStorage'

export function AppStateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id
  const repository: AppRepository = isServerMode ? serverAppRepository : localAppRepository
  const [state, setState] = useState<AppState>(() =>
    isServerMode ? initialAppState : loadAppState(),
  )
  const [account, setAccount] = useState<AccountSnapshot | null>(null)
  const stateRef = useRef(state)
  const [status, setStatus] = useState<AppRuntimeStatus>(isServerMode ? 'loading' : 'local')
  const [message, setMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [migrationDismissed, setMigrationDismissed] = useState(false)
  const [migrationEligible, setMigrationEligible] = useState(false)
  const localMigration = isServerMode ? getLocalDataForMigration() : null

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const applySnapshot = useCallback((snapshot: AppSnapshot) => {
    const nextState: AppState = {
      leaveGrants: snapshot.leaveGrants,
      leaveUsages: snapshot.leaveUsages,
      outings: snapshot.outings,
    }
    stateRef.current = nextState
    setState(nextState)
    setAccount(snapshot.account)
    setMigrationEligible(
      snapshot.account.localMigrationCompletedAt === null &&
        (snapshot.account.onboardingCompletedAt ?? null) === null &&
        snapshot.leaveGrants.length === 0 &&
        snapshot.leaveUsages.length === 0 &&
        snapshot.outings.length === 0,
    )
    if (isServerMode) saveServerCache(snapshot)
  }, [])

  const load = useCallback(async () => {
    if (!isServerMode || !userId) return
    setStatus('loading')
    setMessage(null)
    try {
      const snapshot = await repository.loadSnapshot()
      applySnapshot(snapshot)
      setStatus('ready')
    } catch {
      const cached = loadServerCache(userId)
      if (cached) {
        applySnapshot(cached)
        setStatus('offlineReadonly')
        setMessage('서버에 연결할 수 없어 마지막 동기화 데이터를 읽기 전용으로 보여줍니다.')
      } else {
        setStatus('error')
        setMessage('서버 데이터를 불러오지 못했습니다.')
      }
    }
  }, [applySnapshot, repository, userId])

  useEffect(() => {
    removeExpiredMigrationBackups()
    if (!isServerMode || !userId) return
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load, userId])

  async function dispatch(action: AppAction): Promise<MutationResult> {
    if (!isServerMode) {
      const nextState = appReducer(stateRef.current, action)
      stateRef.current = nextState
      setState(nextState)
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
    }
    if (status === 'offlineReadonly' || status === 'error') {
      return { ok: false, code: 'NETWORK_ERROR', message: '오프라인에서는 기록을 변경할 수 없습니다.' }
    }
    setIsSaving(true)
    const result = await repository.mutate(action, stateRef.current)
    setIsSaving(false)
    if (result.ok) {
      applySnapshot(result.snapshot)
    } else {
      setMessage(result.message)
      if (result.code === 'REVISION_CONFLICT') await load()
    }
    return result
  }

  async function saveOnboarding(requestId: string, selection: OnboardingSelection, expectedRevisions: OnboardingSelection): Promise<MutationResult> {
    if (status !== 'ready') return { ok: false, code: 'NETWORK_ERROR', message: '서버 연결 후 다시 시도해주세요.' }
    setIsSaving(true)
    try {
      const result = await saveServerOnboarding(requestId, selection, expectedRevisions)
      if (result.ok) applySnapshot(result.snapshot)
      else if (result.code === 'REVISION_CONFLICT') applySnapshot(await repository.loadSnapshot())
      return result
    } finally { setIsSaving(false) }
  }

  async function saveOnboardingPlan(requestId: string, plan: OnboardingPlan): Promise<MutationResult> {
    if (status !== 'ready') return { ok: false, code: 'NETWORK_ERROR', message: '서버 연결 후 다시 시도해주세요.' }
    setIsSaving(true)
    try {
      const result = await saveServerOnboardingPlan(requestId, plan)
      if (result.ok) applySnapshot(result.snapshot)
      else if (result.code === 'REVISION_CONFLICT') applySnapshot(await repository.loadSnapshot())
      return result
    } finally { setIsSaving(false) }
  }

  async function migrateLocalData(preserveLocal = false) {
    if (!user || !localMigration) return { ok: false, message: '이전할 로컬 데이터가 없습니다.' }
    setIsSaving(true)
    const result = await repository.migrateLocalData(localMigration)
    setIsSaving(false)
    if (!result.ok) return { ok: false, message: result.message }
    applySnapshot(result.snapshot)
    saveMigrationBackup(user.id, localMigration)
    if (!preserveLocal) clearLocalAppData()
    setMigrationDismissed(true)
    return { ok: true, snapshot: result.snapshot }
  }

  return (
    <AppRuntimeContext value={{
      account,
      saveOnboarding,
      saveOnboardingPlan,
      status,
      message,
      isSaving,
      hasLocalMigration:
        Boolean(localMigration) && migrationEligible && !migrationDismissed,
      retry: load,
      migrateLocalData,
      dismissMigration: () => setMigrationDismissed(true),
    }}>
      <AppStateContext value={state}>
        <AppDispatchContext value={dispatch}>{children}</AppDispatchContext>
      </AppStateContext>
    </AppRuntimeContext>
  )
}
