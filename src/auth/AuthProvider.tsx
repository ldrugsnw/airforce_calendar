import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { clearServerCache } from '../server/appCache'
import { isServerMode, supabase } from '../server/supabaseClient'
import { AuthContext, type AuthStatus } from './authContext'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(isServerMode ? 'initializing' : 'authenticated')
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(data.session?.user ?? null)
      setStatus(data.session ? 'authenticated' : 'unauthenticated')
    })
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setStatus(session ? 'authenticated' : 'unauthenticated')
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({
    status,
    user,
    async signInWithGoogle() {
      if (!supabase) return { ok: false, message: '서버 로그인이 설정되지 않았습니다.' }
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        })
        return error
          ? { ok: false, message: 'Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.' }
          : { ok: true }
      } catch {
        return { ok: false, message: '네트워크 연결을 확인하고 Google 로그인을 다시 시도해주세요.' }
      }
    },
    async signOut() {
      if (user) clearServerCache(user.id)
      if (supabase) await supabase.auth.signOut()
    },
  }), [status, user])

  return <AuthContext value={value}>{children}</AuthContext>
}
