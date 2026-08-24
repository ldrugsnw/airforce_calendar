import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/authContext'

export function LoginPage() {
  const { requestOtp, verifyOtp } = useAuth()
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [step, setStep] = useState<'email' | 'token'>('email')
  const [message, setMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [resendSeconds, setResendSeconds] = useState(0)

  useEffect(() => {
    if (resendSeconds <= 0) return
    const timer = window.setInterval(
      () => setResendSeconds((seconds) => Math.max(0, seconds - 1)),
      1000,
    )
    return () => window.clearInterval(timer)
  }, [resendSeconds])

  async function submit(event: FormEvent) {
    event.preventDefault()
    setIsSubmitting(true)
    setMessage(null)
    const result = step === 'email'
      ? await requestOtp(email)
      : await verifyOtp(email, token)
    setIsSubmitting(false)
    if (!result.ok) {
      setMessage(result.message ?? '요청을 처리하지 못했습니다.')
      return
    }
    if (step === 'email') {
      setStep('token')
      setResendSeconds(60)
      setMessage('가입 가능한 이메일이라면 인증 코드를 보냈습니다. 스팸함도 확인해주세요.')
    }
  }

  async function resend() {
    setIsSubmitting(true)
    const result = await requestOtp(email)
    setIsSubmitting(false)
    setMessage(
      result.ok
        ? '인증 코드를 다시 요청했습니다. 새 코드만 사용할 수 있습니다.'
        : result.message ?? '인증 코드를 다시 보내지 못했습니다.',
    )
    if (result.ok) setResendSeconds(60)
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg items-center bg-white px-5 py-10">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold text-brand-600">공군 휴가 캘린더</p>
        <h1 className="mt-2 text-2xl font-bold text-slate-950">이메일로 로그인</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          비공개 베타에 등록된 이메일로 6자리 인증 코드를 받아 로그인합니다.
        </p>
        <form className="mt-6" onSubmit={submit}>
          <label className="block text-sm font-semibold text-slate-800" htmlFor="login-email">
            이메일
            <input
              autoComplete="email"
              className="mt-2 h-14 w-full rounded-2xl border border-slate-300 px-4 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              disabled={step === 'token'}
              id="login-email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />
          </label>
          {step === 'token' && (
            <label className="mt-4 block text-sm font-semibold text-slate-800" htmlFor="login-token">
              인증 코드
              <input
                autoComplete="one-time-code"
                className="mt-2 h-14 w-full rounded-2xl border border-slate-300 px-4 text-center text-xl tracking-[0.35em] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                id="login-token"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) => setToken(event.target.value.replace(/\D/g, ''))}
                pattern="[0-9]{6}"
                required
                value={token}
              />
            </label>
          )}
          {message && (
            <p className="mt-3 text-sm leading-6 text-slate-600" role="status">{message}</p>
          )}
          <button
            className="mt-5 min-h-12 w-full rounded-2xl bg-brand-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isSubmitting}
            type="submit"
          >
            {isSubmitting ? '처리 중…' : step === 'email' ? '인증 코드 받기' : '로그인'}
          </button>
          {step === 'token' && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                className="min-h-11 text-sm font-semibold text-slate-600 disabled:text-slate-400"
                disabled={isSubmitting || resendSeconds > 0}
                onClick={() => void resend()}
                type="button"
              >
                {resendSeconds > 0 ? `${resendSeconds}초 후 재전송` : '코드 재전송'}
              </button>
              <button
                className="min-h-11 text-sm font-semibold text-slate-600"
                onClick={() => { setStep('email'); setToken(''); setMessage(null) }}
                type="button"
              >
                다른 이메일 사용
              </button>
            </div>
          )}
        </form>
      </section>
    </main>
  )
}
