import { useState } from 'react'
import { useAuth } from '../auth/authContext'

function getOAuthCallbackMessage() {
  const query = new URLSearchParams(window.location.search)
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const error = query.get('error') ?? hash.get('error')
  const errorCode = query.get('error_code') ?? hash.get('error_code')

  if (!error && !errorCode) return null
  if (error === 'access_denied' || errorCode === 'access_denied') {
    return 'Google 로그인이 취소되었습니다. 다시 시도할 수 있습니다.'
  }
  return 'Google 로그인 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.'
}

export function LoginPage() {
  const { signInWithGoogle } = useAuth()
  const [message, setMessage] = useState<string | null>(getOAuthCallbackMessage)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function startGoogleLogin() {
    setIsSubmitting(true)
    setMessage(null)
    const result = await signInWithGoogle()
    if (!result.ok) {
      setIsSubmitting(false)
      setMessage(result.message ?? '요청을 처리하지 못했습니다.')
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center bg-white px-5 py-10">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brand-600">공군 휴가 캘린더</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">로그인</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Google 계정으로 로그인하면 여러 기기에서 같은 휴가 기록을 확인할 수 있습니다.
        </p>
        {message && (
          <p className="mt-5 rounded-2xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700" role="status">
            {message}
          </p>
        )}
        <button
          className="mt-6 flex min-h-12 w-full items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm disabled:opacity-60"
          disabled={isSubmitting}
          onClick={() => void startGoogleLogin()}
          type="button"
        >
          <span aria-hidden="true" className="text-base font-bold text-brand-600">G</span>
          {isSubmitting ? 'Google로 이동 중…' : 'Google로 계속하기'}
        </button>
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">
          로그인에는 이메일 주소와 기본 프로필 정보만 사용합니다.
        </p>
      </section>
    </main>
  )
}
