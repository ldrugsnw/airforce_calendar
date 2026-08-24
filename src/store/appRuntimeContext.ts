import { createContext, useContext } from 'react'

export type AppRuntimeStatus = 'local' | 'loading' | 'ready' | 'offlineReadonly' | 'error'

export type AppRuntimeContextValue = {
  status: AppRuntimeStatus
  message: string | null
  isSaving: boolean
  hasLocalMigration: boolean
  retry: () => Promise<void>
  migrateLocalData: () => Promise<{ ok: boolean; message?: string }>
  dismissMigration: () => void
}

export const AppRuntimeContext = createContext<AppRuntimeContextValue | null>(null)

export function useAppRuntime() {
  const value = useContext(AppRuntimeContext)
  if (!value) throw new Error('useAppRuntime은 AppStateProvider 안에서 사용해야 합니다.')
  return value
}
