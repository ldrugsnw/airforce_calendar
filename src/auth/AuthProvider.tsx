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
    async requestOtp(email: string) {
      if (!supabase) return { ok: false, message: '서버 로그인이 설정되지 않았습니다.' }
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(), options: { shouldCreateUser: true },
      })
      return error
        ? { ok: false, message: '인증 코드를 보내지 못했습니다. 잠시 후 다시 시도해주세요.' }
        : { ok: true }
    },
    async verifyOtp(email: string, token: string) {
      if (!supabase) return { ok: false, message: '서버 로그인이 설정되지 않았습니다.' }
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(), token: token.trim(), type: 'email',
      })
      return error
        ? { ok: false, message: '인증 코드가 올바르지 않거나 만료되었습니다.' }
        : { ok: true }
    },
    async signOut() {
      if (user) clearServerCache(user.id)
      if (supabase) await supabase.auth.signOut()
    },
  }), [status, user])

  return <AuthContext value={value}>{children}</AuthContext>
}
