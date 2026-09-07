import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/authContext'

export function LoginPage() {
  const { requestLoginLink } = useAuth()
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(null)
    const result = await requestLoginLink(email)
    setIsSubmitting(false)
    if (!result.ok) {
      setMessage(result.message ?? '요청을 처리하지 못했습니다.')
      return
    }
    setMessage('로그인 링크를 보냈습니다. 이메일의 링크를 눌러 앱으로 돌아오세요. 스팸함도 확인해주세요.')
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center bg-white px-5 py-10">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brand-600">공군 휴가 캘린더</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">이메일로 로그인</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          이메일로 받은 로그인 링크를 누르면 바로 시작할 수 있습니다.
        </p>
        <form className="mt-6" onSubmit={submit}>
          <label className="block text-sm font-semibold text-slate-800" htmlFor="login-email">
            이메일
            <input
              autoComplete="email"
              className="mt-2 h-14 w-full rounded-2xl border border-slate-300 px-4 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              id="login-email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          {message && (
            <p className="mt-3 text-sm leading-6 text-slate-600" role="status">{message}</p>
          )}
          <button
            className="mt-5 min-h-12 w-full rounded-2xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? '처리 중…' : '로그인 링크 받기'}
          </button>
        </form>
      </section>
    </main>
  )
}
