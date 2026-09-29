import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  MAX_LEAVE_GRANT_DAYS,
  MIN_LEAVE_GRANT_DAYS,
  type LeaveGrant,
} from '../domain/leave'
import { useAppDispatch, useAppState } from '../store/appStateContext'
import {
  loadOnboardingState,
  saveOnboardingState,
  type LocalOnboardingState,
} from '../store/appStorage'

type ReviewLeaveType = 'annual' | 'performance'
type ReviewItem = { type: ReviewLeaveType; label: string; included: boolean; days: string; touched: boolean }
type SavedItem = { type: ReviewLeaveType; label: string; days: number }

const initialItems: ReviewItem[] = [
  { type: 'annual', label: '연가', included: true, days: '', touched: false },
  { type: 'performance', label: '성과제', included: false, days: '', touched: false },
]

function getDaysError(item: ReviewItem) {
  if (!item.included) return null
  const days = Number(item.days)
  if (
    item.days.trim() === '' ||
    !Number.isInteger(days) ||
    days < MIN_LEAVE_GRANT_DAYS ||
    days > MAX_LEAVE_GRANT_DAYS
  ) {
    return `${item.label} 보유 일수를 ${MIN_LEAVE_GRANT_DAYS}~${MAX_LEAVE_GRANT_DAYS}일 정수로 입력해주세요.`
  }
  return null
}

export function AirForceOnboardingPage({
  initialState,
}: {
  initialState: LocalOnboardingState | null
}) {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const { leaveGrants } = useAppState()
  const [branchSelected, setBranchSelected] = useState(initialState?.branch === 'air_force')
  const [items, setItems] = useState(initialItems)
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedItems, setSavedItems] = useState<SavedItem[] | null>(null)
  const submitting = useRef(false)
  const selectedItems = items.filter((item) => item.included)
  const hasValidSelection = selectedItems.length > 0 && selectedItems.every((item) => !getDaysError(item))
  const isIntroduction = !savedItems && !branchSelected

  function startAirForce() {
    const saved = saveOnboardingState({
      version: 1,
      branch: 'air_force',
      leaveSetupCompletedAt: null,
    })
    if (saved) setBranchSelected(true)
    else setError('설정을 저장하지 못했습니다. 다시 시도해주세요.')
  }

  function changeItem(type: ReviewLeaveType, change: Partial<ReviewItem>) {
    setItems((current) => current.map((item) => {
      if (item.type !== type) return item
      const inclusionChanged = change.included !== undefined && change.included !== item.included
      return { ...item, ...change, touched: inclusionChanged ? false : item.touched }
    }))
    setError(null)
  }

  function changeDays(type: ReviewLeaveType, days: string) {
    setItems((current) => current.map((item) => {
      if (item.type !== type) return item
      const nextItem = { ...item, days }
      return { ...nextItem, touched: item.touched || Boolean(getDaysError(nextItem)) }
    }))
    setError(null)
  }

  function touchDays(type: ReviewLeaveType) {
    setItems((current) => current.map((item) => item.type === type ? { ...item, touched: true } : item))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return

    if (!hasValidSelection) return

    submitting.current = true
    setIsSaving(true)
    setError(null)
    const now = new Date().toISOString()
    try {
      for (const item of selectedItems) {
        const id = `air-force-onboarding-${item.type}`
        // Reusing these stable IDs makes a retried onboarding submission idempotent.
        if (leaveGrants.some((grant) => grant.id === id)) continue
        const leaveGrant: LeaveGrant = {
          id,
          type: item.type,
          days: Number(item.days),
          acquiredDate: null,
          reason: '',
          memo: '',
          createdAt: now,
          updatedAt: now,
        }
        const result = await dispatch({ type: 'leaveGrant/added', payload: leaveGrant })
        if (!result.ok) {
          setError(result.message)
          return
        }
      }

      const currentOnboarding = loadOnboardingState()
      const completion: LocalOnboardingState = {
        version: 1,
        branch: 'air_force',
        leaveSetupCompletedAt: new Date().toISOString(),
      }
      if (!currentOnboarding || !saveOnboardingState(completion)) {
        setError('휴가를 저장했지만 설정 완료를 기록하지 못했습니다. 다시 제출해주세요.')
        return
      }
      setSavedItems(selectedItems.map((item) => ({
        type: item.type,
        label: item.label,
        days: Number(item.days),
      })))
    } catch {
      setError('휴가를 저장하지 못했습니다. 다시 시도해주세요.')
    } finally {
      submitting.current = false
      setIsSaving(false)
    }
  }

  return (
    <main className={`min-h-dvh bg-slate-50 ${isIntroduction ? '' : 'px-5 pb-8 pt-8 sm:py-10'}`}>
      <div className={isIntroduction ? 'min-h-dvh w-full' : 'mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-2xl flex-col'}>
        {savedItems ? (
          <section className="m-auto w-full rounded-2xl bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold text-brand-600">공군 휴가 캘린더 · 설정 완료</p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">기본 휴가 설정을 완료했어요</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              이제 달력에서 휴가를 사용할 날짜를 계획해보세요.
            </p>
            <ul className="mt-6 space-y-3" aria-label="저장된 휴가">
              {savedItems.map((item) => (
                <li className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3" key={item.type}>
                  <span className="font-semibold text-slate-900">{item.label}</span>
                  <span className="text-sm font-semibold text-brand-700">{item.days}일</span>
                </li>
              ))}
            </ul>
            <button
              className="mt-8 min-h-12 w-full rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
              onClick={() => navigate('/calendar', { replace: true })}
              type="button"
            >
              첫 휴가 계획하기
            </button>
          </section>
        ) : !branchSelected ? (
          <section className="relative isolate min-h-dvh overflow-x-clip bg-slate-950 px-5 pb-6 pt-[calc(1.5rem_+_env(safe-area-inset-top,0px))] text-white sm:px-8 sm:pb-10 sm:pt-[calc(2.5rem_+_env(safe-area-inset-top,0px))]">
            <div className="pointer-events-none absolute -left-24 top-1/4 size-72 rounded-full bg-brand-600/20 blur-3xl" />
            <div className="pointer-events-none absolute -right-32 -top-24 size-80 rounded-full bg-blue-400/15 blur-3xl" />

            <div className="onboarding-hero-layout relative mx-auto min-h-[calc(100dvh-3rem)] w-full max-w-6xl sm:min-h-[calc(100dvh-5rem)]">
              <div className="onboarding-hero-copy self-start lg:self-center">
                <p className="inline-flex items-center gap-2 text-sm font-medium text-blue-200">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-blue-400" />
                  1/3 · 시작
                </p>
                <h1 className="mt-5 max-w-xl text-balance text-[2rem] font-bold leading-[1.22] tracking-tight text-white sm:text-5xl sm:leading-[1.15]">
                  공군 휴가, 받는 날부터 쓰는 날까지
                </h1>
                <p className="mt-4 max-w-lg text-base leading-7 text-slate-300 sm:mt-5 sm:text-lg sm:leading-8">
                  보유 휴가를 기록하고 전역 전까지 사용할 날짜를 한눈에 계획해보세요.
                </p>
              </div>

              <div aria-hidden="true" className="onboarding-hero-visual relative mx-auto h-64 w-full max-w-sm sm:h-72 lg:h-[25rem] lg:max-w-lg">
                <div className="absolute inset-x-5 bottom-3 top-5 rotate-[-4deg] rounded-[2rem] border border-white/10 bg-white/[0.07] p-4 shadow-2xl shadow-blue-950/40 backdrop-blur-sm sm:inset-x-8 sm:p-5 lg:inset-x-10 lg:bottom-10 lg:top-10">
                  <div className="flex items-center gap-2 border-b border-white/10 pb-3">
                    <span className="size-2 rounded-full bg-red-400/80" />
                    <span className="size-2 rounded-full bg-amber-300/80" />
                    <span className="size-2 rounded-full bg-green-400/80" />
                    <span className="ml-auto h-2 w-16 rounded-full bg-white/10" />
                  </div>
                  <div className="mt-4 grid grid-cols-7 gap-2 sm:gap-2.5">
                    {Array.from({ length: 28 }, (_, index) => (
                      <span
                        className={`aspect-square rounded-md ${[8, 15, 18, 23].includes(index) ? 'bg-blue-400/25 ring-1 ring-inset ring-blue-300/20' : 'bg-white/[0.06]'}`}
                        key={index}
                      />
                    ))}
                  </div>
                </div>

                <div className="onboarding-float absolute right-0 top-1 flex min-w-28 items-center gap-2.5 rounded-2xl bg-blue-500 px-4 py-3 font-bold text-white shadow-xl shadow-blue-950/40 sm:right-2 sm:top-3">
                  <span className="size-3 rounded bg-white/35" />
                  연가
                </div>
                <div className="onboarding-float onboarding-float-delay-1 absolute left-0 top-[43%] flex min-w-28 items-center gap-2.5 rounded-2xl bg-green-500 px-4 py-3 font-bold text-white shadow-xl shadow-green-950/30 sm:left-1">
                  <span className="size-3 rounded bg-white/35" />
                  성과제
                </div>
                <div className="onboarding-float onboarding-float-delay-2 absolute bottom-1 right-4 flex min-w-32 items-center gap-2.5 rounded-2xl bg-red-500 px-4 py-3 font-bold text-white shadow-xl shadow-red-950/30 sm:bottom-3 sm:right-7 lg:bottom-8">
                  <span className="size-3 rounded bg-white/35" />
                  포상 휴가
                </div>
              </div>

              <div className="onboarding-hero-actions w-full justify-self-center self-start sm:max-w-sm lg:self-center">
                <p className="flex items-center justify-center gap-2 text-center text-sm leading-6 text-slate-300">
                  <span className="size-1.5 shrink-0 rounded-full bg-blue-400" aria-hidden="true" />
                  현재는 공군 휴가 관리를 지원하고 있어요.
                </p>
                <button
                  className="mt-5 min-h-14 w-full rounded-2xl bg-brand-600 px-5 text-base font-semibold text-white shadow-lg shadow-blue-950/30 transition-colors hover:bg-brand-700"
                  onClick={startAirForce}
                  type="button"
                >
                  내 휴가 설정하기
                </button>
                <p className="mt-3 text-center text-xs leading-5 text-slate-400">
                  약 1분 소요 · 언제든 수정할 수 있어요
                </p>
                {error && <p className="mt-3 text-sm text-red-300" role="alert">{error}</p>}
              </div>
            </div>
          </section>
        ) : (
          <>
            <header className="pb-7">
              <p className="text-sm font-semibold text-brand-600">공군 휴가 캘린더 · 기본 설정</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">현재 보유 휴가를 등록해주세요</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                지금 등록해두면 남은 휴가와 사용 계획을 바로 확인할 수 있어요.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                나중에 내 휴가에서 언제든 수정할 수 있습니다.
              </p>
            </header>

            <form className="flex flex-1 flex-col" noValidate onSubmit={handleSubmit}>
              <div className="space-y-4">
                {items.map((item) => {
                  const visibleError = item.touched ? getDaysError(item) : null
                  return (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" key={item.type}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-950">{item.label}</h2>
                        <p className="mt-1 text-sm text-slate-500">현재 보유한 총 일수를 입력하세요</p>
                      </div>
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-700">
                        <input
                          aria-label={`${item.label} 포함`}
                          checked={item.included}
                          className="h-5 w-5 accent-brand-600"
                          onChange={(event) => changeItem(item.type, { included: event.target.checked })}
                          type="checkbox"
                        />
                        포함
                      </label>
                    </div>
                    {item.included && (
                      <>
                      <div className="mt-5 grid grid-cols-[3.5rem_1fr_3.5rem] gap-2">
                        <button
                          aria-label={`${item.label} 일수 줄이기`}
                          className="min-h-14 rounded-xl border border-slate-300 bg-white text-xl font-bold text-slate-700 active:bg-slate-100"
                          onClick={() => changeDays(item.type, String(Math.max(0, (Number(item.days) || 0) - 1)))}
                          type="button"
                        >−</button>
                        <div className="relative">
                          <input
                            aria-label={`${item.label} 보유 일수`}
                            aria-describedby={`${item.type}-days-error`}
                            aria-invalid={Boolean(visibleError)}
                            className={`h-14 w-full rounded-xl border bg-white px-4 pr-12 text-base text-slate-950 outline-none focus:ring-2 ${visibleError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'}`}
                            inputMode="numeric"
                            max={MAX_LEAVE_GRANT_DAYS}
                            min="0"
                            onBlur={() => touchDays(item.type)}
                            onChange={(event) => changeDays(item.type, event.target.value)}
                            placeholder="일수 입력"
                            type="number"
                            value={item.days}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-500">일</span>
                        </div>
                        <button
                          aria-label={`${item.label} 일수 늘리기`}
                          className="min-h-14 rounded-xl border border-slate-300 bg-white text-xl font-bold text-slate-700 active:bg-slate-100"
                          onClick={() => changeDays(item.type, String(Math.min(MAX_LEAVE_GRANT_DAYS, (Number(item.days) || 0) + 1)))}
                          type="button"
                        >+</button>
                      </div>
                      <p
                        className="mt-2 min-h-[4.5rem] text-sm leading-6 text-red-600"
                        id={`${item.type}-days-error`}
                        role={visibleError ? 'alert' : undefined}
                      >
                        {visibleError ?? '\u00a0'}
                      </p>
                      </>
                    )}
                  </section>
                  )
                })}
              </div>
              {selectedItems.length === 0 && <p className="mt-4 text-sm font-medium text-red-600" role="alert">저장할 휴가를 하나 이상 선택해주세요.</p>}
              {error && <p className="mt-4 text-sm font-medium text-red-600" role="alert">{error}</p>}
              <div className="mt-auto pt-8">
                <button
                  className="min-h-14 w-full rounded-xl bg-brand-600 px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
                  disabled={isSaving || !hasValidSelection}
                  type="submit"
                >
                  {isSaving ? '저장 중…' : '휴가 설정 저장하기'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
