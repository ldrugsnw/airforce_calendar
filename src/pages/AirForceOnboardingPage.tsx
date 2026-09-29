import { useState } from 'react'
import {
  saveOnboardingState,
  type LocalOnboardingState,
} from '../store/appStorage'

export function AirForceOnboardingPage({
  initialState,
}: {
  initialState: LocalOnboardingState | null
}) {
  const [started, setStarted] = useState(initialState?.branch === 'air_force')
  const [saveFailed, setSaveFailed] = useState(false)

  function startAirForce() {
    const saved = saveOnboardingState({
      version: 1,
      branch: 'air_force',
      leaveSetupCompletedAt: null,
    })
    setSaveFailed(!saved)
    if (saved) setStarted(true)
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-5 py-10">
      <section className="w-full max-w-lg rounded-2xl bg-white px-6 py-10 shadow-sm sm:px-8" aria-live="polite">
        {started ? (
          <div>
            <p className="text-sm font-semibold text-brand-600">공군 휴가 캘린더</p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">공군으로 설정했어요</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">다음 단계에서 기본 휴가를 설정합니다.</p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold text-brand-600">공군 휴가 캘린더</p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">현재 공군에서 복무 중인가요?</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">현재는 공군 휴가 관리만 지원해요.</p>
            <button
              className="mt-8 min-h-12 w-full rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              onClick={startAirForce}
              type="button"
            >
              공군으로 시작하기
            </button>
            {saveFailed && <p className="mt-3 text-sm font-medium text-red-600" role="alert">설정을 저장하지 못했습니다. 다시 시도해주세요.</p>}
          </div>
        )}
      </section>
    </main>
  )
}
