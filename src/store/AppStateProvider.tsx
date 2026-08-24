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
  serverAppRepository,
  type AppRepository,
} from '../server/appRepository'
import type { AppSnapshot, MutationResult } from '../server/appSnapshot'
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
  const repository: AppRepository = isServerMode ? serverAppRepository : localAppRepository
  const [state, setState] = useState<AppState>(() =>
    isServerMode ? initialAppState : loadAppState(),
  )
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
    setMigrationEligible(
      snapshot.account.localMigrationCompletedAt === null &&
        snapshot.leaveGrants.length === 0 &&
        snapshot.leaveUsages.length === 0 &&
        snapshot.outings.length === 0,
    )
    if (isServerMode) saveServerCache(snapshot)
  }, [])

  const load = useCallback(async () => {
    if (!isServerMode || !user) return
    setStatus('loading')
    setMessage(null)
    try {
      const snapshot = await repository.loadSnapshot()
      applySnapshot(snapshot)
      setStatus('ready')
    } catch {
      const cached = loadServerCache(user.id)
      if (cached) {
        applySnapshot(cached)
        setStatus('offlineReadonly')
        setMessage('서버에 연결할 수 없어 마지막 동기화 데이터를 읽기 전용으로 보여줍니다.')
      } else {
        setStatus('error')
        setMessage('서버 데이터를 불러오지 못했습니다.')
      }
    }
  }, [applySnapshot, repository, user])

  useEffect(() => {
    removeExpiredMigrationBackups()
    if (!isServerMode || !user) return
    const timeoutId = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [load, user])

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

  async function migrateLocalData() {
    if (!user || !localMigration) return { ok: false, message: '이전할 로컬 데이터가 없습니다.' }
    setIsSaving(true)
    const result = await repository.migrateLocalData(localMigration)
    setIsSaving(false)
    if (!result.ok) return { ok: false, message: result.message }
    applySnapshot(result.snapshot)
    saveMigrationBackup(user.id, localMigration)
    clearLocalAppData()
    setMigrationDismissed(true)
    return { ok: true }
  }

  return (
    <AppRuntimeContext value={{
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
