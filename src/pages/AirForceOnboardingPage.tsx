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
  const submitting = useRef(false)
  const selectedItems = items.filter((item) => item.included)
  const hasValidSelection = selectedItems.length > 0 && selectedItems.every((item) => !getDaysError(item))

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
      navigate('/calendar', { replace: true })
    } catch {
      setError('휴가를 저장하지 못했습니다. 다시 시도해주세요.')
    } finally {
      submitting.current = false
      setIsSaving(false)
    }
  }

  return (
    <main className="min-h-dvh bg-slate-50 px-5 pb-8 pt-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-2xl flex-col">
        {!branchSelected ? (
          <section className="m-auto w-full rounded-2xl bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold text-brand-600">공군 휴가 캘린더</p>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950">현재 공군에서 복무 중인가요?</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">현재는 공군 휴가 관리만 지원해요.</p>
            <button className="mt-8 min-h-12 w-full rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700" onClick={startAirForce} type="button">
              공군으로 시작하기
            </button>
            {error && <p className="mt-3 text-sm text-red-600" role="alert">{error}</p>}
          </section>
        ) : (
          <>
            <header className="pb-7">
              <p className="text-sm font-semibold text-brand-600">공군 휴가 캘린더 · 기본 설정</p>
              <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">기본 휴가를 확인해주세요</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                부대·복무 시기·개인 상황에 따라 실제 보유량이 다를 수 있어요. 현재 보유 일수에 맞게 수정해주세요.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                정확한 일수를 모르겠다면 부대에서 확인한 뒤 나중에 수정할 수 있어요.
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
                  {isSaving ? '저장 중…' : '선택한 휴가로 시작하기'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
