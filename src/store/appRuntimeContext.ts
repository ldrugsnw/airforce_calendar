import type { AccountSnapshot, AppSnapshot, MutationResult } from '../server/appSnapshot'
import type { OnboardingSelection, OnboardingPlan } from '../server/appRepository'
import { createContext, useContext } from 'react'

export type AppRuntimeStatus = 'local' | 'loading' | 'ready' | 'offlineReadonly' | 'error'

export type AppRuntimeContextValue = {
  account: AccountSnapshot | null
  saveOnboarding: (requestId: string, selection: OnboardingSelection, expectedRevisions: OnboardingSelection) => Promise<MutationResult>
  saveOnboardingPlan: (requestId: string, plan: OnboardingPlan) => Promise<MutationResult>
  status: AppRuntimeStatus
  message: string | null
  isSaving: boolean
  hasLocalMigration: boolean
  retry: () => Promise<void>
  migrateLocalData: (preserveLocal?: boolean) => Promise<{ ok: boolean; message?: string; snapshot?: AppSnapshot }>
  dismissMigration: () => void
}

export const AppRuntimeContext = createContext<AppRuntimeContextValue | null>(null)

export function useAppRuntime() {
  const value = useContext(AppRuntimeContext)
  if (!value) throw new Error('useAppRuntime은 AppStateProvider 안에서 사용해야 합니다.')
  return value
}
