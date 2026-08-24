import { createContext, useContext } from 'react'
import type { AppAction, AppState } from './appReducer'
import type { MutationResult } from '../server/appSnapshot'

export const AppStateContext = createContext<AppState | null>(null)
export type AppDispatch = (action: AppAction) => Promise<MutationResult>
export const AppDispatchContext = createContext<AppDispatch | null>(null)

export function useAppState() {
  const state = useContext(AppStateContext)

  if (!state) {
    throw new Error('useAppState는 AppStateProvider 안에서 사용해야 합니다.')
  }

  return state
}

export function useAppDispatch() {
  const dispatch = useContext(AppDispatchContext)

  if (!dispatch) {
    throw new Error('useAppDispatch는 AppStateProvider 안에서 사용해야 합니다.')
  }

  return dispatch
}
