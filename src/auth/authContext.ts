import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

export type AuthStatus = 'initializing' | 'authenticated' | 'unauthenticated'

export type AuthContextValue = {
  status: AuthStatus
  user: User | null
  requestOtp: (email: string) => Promise<{ ok: boolean; message?: string }>
  verifyOtp: (email: string, token: string) => Promise<{ ok: boolean; message?: string }>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth는 AuthProvider 안에서 사용해야 합니다.')
  return value
}
