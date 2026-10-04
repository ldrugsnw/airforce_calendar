import { useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router'
import {
  MAX_LEAVE_GRANT_DAYS,
  MIN_LEAVE_GRANT_DAYS,
  getLeaveTypeLabel,
  type LeaveGrant,
} from '../domain/leave'
import { isServerMode } from '../server/supabaseClient'
import { useAppRuntime } from '../store/appRuntimeContext'
import { createOnboardingPlan, createReviewItems, getOnboardingChanges, validateOnboardingChanges, type ReviewItem } from '../domain/onboarding'
import type { OnboardingPlan } from '../server/appRepository'
import type { OnboardingSelection } from '../server/appRepository'
import { useAppDispatch, useAppState } from '../store/appStateContext'
import {
  getLocalDataForMigration,
  loadOnboardingState,
  saveOnboardingState,
  type LocalOnboardingState,
} from '../store/appStorage'

type SavedItem = { key: string; label: string; days: number }

const initialItems: ReviewItem[] = [
  { key: 'annual', type: 'annual', label: '연가', included: true, days: '', touched: false },
  { key: 'performance', type: 'performance', label: '성과제', included: false, days: '', touched: false },
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
  const runtime = useAppRuntime()
  const pendingRequest = useRef<{ key: string; id: string } | null>(null)
  const dispatch = useAppDispatch()
  const state = useAppState()
  const { leaveGrants } = state
  const localRecords = isServerMode && runtime.hasLocalMigration ? getLocalDataForMigration() : null
  const serverHasRecords = leaveGrants.length > 0 || state.leaveUsages.length > 0 || state.outings.length > 0
  const hasExistingRecords = serverHasRecords || Boolean(localRecords)
  const [showExistingChoice, setShowExistingChoice] = useState(false)
  const reviewInitialized = useRef(false)
  const [confirmation, setConfirmation] = useState<OnboardingPlan | null>(null)
  const otherGrants = isServerMode ? leaveGrants.filter((grant) => grant.type !== 'annual' && grant.type !== 'performance') : []
  const [branchSelected, setBranchSelected] = useState(initialState?.branch === 'air_force')
  const [items, setItems] = useState(() => initialItems.map((item) => {
    const grant = leaveGrants.find((grant) => grant.id === `air-force-onboarding-${item.type}`)
    return grant ? { ...item, included: true, days: String(grant.days) } : item
  }))
  const [error, setError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [savedItems, setSavedItems] = useState<SavedItem[] | null>(null)
  const submitting = useRef(false)
  const selectedItems = items.filter((item) => item.included)
  const hasValidSelection = (selectedItems.length > 0 || otherGrants.length > 0) && selectedItems.every((item) => !getDaysError(item))
  const isIntroduction = !savedItems && !branchSelected && !showExistingChoice && !confirmation

  function startAirForce() {
    if (isServerMode) {
      if (hasExistingRecords && !reviewInitialized.current) setShowExistingChoice(true)
      else setBranchSelected(true)
      return
    }
    const saved = saveOnboardingState({
      version: 1,
      branch: 'air_force',
      leaveSetupCompletedAt: loadOnboardingState()?.leaveSetupCompletedAt ?? null,
    })
    if (saved) setBranchSelected(true)
    else setError('설정을 저장하지 못했습니다. 다시 시도해주세요.')
  }

  function changeItem(key: string, change: Partial<ReviewItem>) {
    setItems((current) => current.map((item) => {
      if (item.key !== key) return item
      const inclusionChanged = change.included !== undefined && change.included !== item.included
      return { ...item, ...change, touched: inclusionChanged ? false : item.touched }
    }))
    setError(null)
  }

  function changeDays(key: string, days: string) {
    setItems((current) => current.map((item) => {
      if (item.key !== key) return item
      const nextItem = { ...item, days }
      return { ...nextItem, touched: item.touched || Boolean(getDaysError(nextItem)) }
    }))
    setError(null)
  }

  function touchDays(key: string) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, touched: true } : item))
  }

  function returnToLeaveReview() {
    setSavedItems(null)
    setBranchSelected(true)
    setError(null)
  }

  async function chooseExisting(continueRecords: boolean) {
    if (submitting.current) return
    submitting.current = true
    setIsSaving(true)
    setError(null)
    try {
      let grants = leaveGrants
      if (continueRecords && localRecords) {
        const result = await runtime.migrateLocalData(true)
        if (!result.ok || !result.snapshot) { setError(result.message ?? '기존 기록을 불러오지 못했습니다.'); return }
        grants = result.snapshot.leaveGrants
      }
      setItems(createReviewItems(grants, !continueRecords))
      reviewInitialized.current = true
      setShowExistingChoice(false)
      setBranchSelected(true)
    } catch { setError('기존 기록을 불러오지 못했습니다. 다시 시도해주세요.') }
    finally { submitting.current = false; setIsSaving(false) }
  }

  async function savePlan(plan: OnboardingPlan) {
    if (submitting.current) return
    submitting.current = true
    setIsSaving(true)
    setError(null)
    try {
      const key = JSON.stringify(plan)
      if (pendingRequest.current?.key !== key) pendingRequest.current = { key, id: crypto.randomUUID() }
      const result = await runtime.saveOnboardingPlan(pendingRequest.current.id, plan)
      if (!result.ok) {
        setError(result.message)
        if (result.code === 'REVISION_CONFLICT') setConfirmation(null)
        return
      }
      pendingRequest.current = null
      setConfirmation(null)
      const ids = result.snapshot.account.onboardingGrantIds as Record<string, string> | null
      setItems((current) => current.map((item) => ({ ...item, grantId: item.grantId ?? ids?.[item.key] })))
      setSavedItems(result.snapshot.leaveGrants.map((grant) => ({ key: grant.id, label: getLeaveTypeLabel(grant.type), days: grant.days })))
    } catch { setError('휴가를 저장하지 못했습니다. 다시 시도해주세요.') }
    finally { submitting.current = false; setIsSaving(false) }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current) return

    if (!hasValidSelection) {
      setItems((current) => current.map((item) => item.included ? { ...item, touched: true } : item))
      return
    }

    if (isServerMode && (serverHasRecords || runtime.account?.onboardingGrantIds || runtime.account?.localMigrationCompletedAt)) {
      const plan = createOnboardingPlan(items, state, runtime.account?.onboardingGrantIds)
      const validationError = validateOnboardingChanges(plan)
      if (validationError) { setError(validationError); return }
      if (getOnboardingChanges(plan).some((change) => change.old)) {
        setError(null)
        setConfirmation({ ...plan, confirmed: true })
      } else await savePlan(plan)
      return
    }

    submitting.current = true
    setIsSaving(true)
    setError(null)
    const now = new Date().toISOString()
    try {
      if (isServerMode) {
        const selection = Object.fromEntries(items.map((item) => [item.type, item.included ? Number(item.days) : null])) as OnboardingSelection
        const expectedRevisions = Object.fromEntries(items.map((item) => [item.type,
          leaveGrants.find((grant) => grant.id === runtime.account?.onboardingGrantIds?.[item.type])?.revision ?? 0,
        ])) as OnboardingSelection
        const key = JSON.stringify({ selection, expectedRevisions })
        if (pendingRequest.current?.key !== key) pendingRequest.current = { key, id: crypto.randomUUID() }
        const result = await runtime.saveOnboarding(pendingRequest.current.id, selection, expectedRevisions)
        if (!result.ok) { setError(result.message); return }
        pendingRequest.current = null
      } else {
        for (const item of items) {
          const id = `air-force-onboarding-${item.type}`
          const existingGrant = leaveGrants.find((grant) => grant.id === id)
          // Only reconcile onboarding grants; stable IDs also make retries safe.
          if (!item.included) {
            if (!existingGrant) continue
            const result = await dispatch({ type: 'leaveGrant/deleted', payload: { id } })
            if (!result.ok) {
              setError(result.message)
              return
            }
            continue
          }
          if (existingGrant?.days === Number(item.days)) continue
          const leaveGrant: LeaveGrant = {
            id,
            type: item.type,
            acquiredDate: null,
            reason: '',
            memo: '',
            createdAt: now,
            ...existingGrant,
            days: Number(item.days),
            updatedAt: now,
          }
          const result = await dispatch({
            type: existingGrant ? 'leaveGrant/updated' : 'leaveGrant/added',
            payload: leaveGrant,
          })
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
      }
      setSavedItems(selectedItems.map((item) => ({
        key: item.key,
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
            <div className="flex items-center gap-2">
              <button
                aria-label="이전 단계로 돌아가기"
                className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-slate-600 transition-[background-color,color,transform] duration-150 ease-out hover:bg-slate-100 hover:text-slate-950 active:scale-95 active:bg-slate-200 motion-reduce:transform-none motion-reduce:transition-none"
                onClick={returnToLeaveReview}
                type="button"
              >
                <svg aria-hidden="true" className="size-6 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
                </svg>
              </button>
              <p className="text-sm font-semibold text-brand-600">공군 휴가 캘린더 · 설정 완료</p>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">기본 휴가 설정을 완료했어요</h1>
            <p className="mt-3 text-base leading-7 text-slate-600">
              이제 달력에서 휴가를 사용할 날짜를 계획해보세요.
            </p>
            <ul className="mt-6 space-y-3" aria-label="저장된 휴가">
              {savedItems.map((item) => (
                <li className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3" key={item.key}>
                  <span className="font-semibold text-slate-900">{item.label}</span>
                  <span className="text-sm font-semibold text-brand-700">{item.days}일</span>
                </li>
              ))}
            </ul>
            <button
              className="mt-4 min-h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={returnToLeaveReview}
              type="button"
            >
              연가·성과제 일수 수정하기
            </button>
            <button
              className="mt-8 min-h-12 w-full rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700"
              onClick={() => navigate('/calendar', { replace: true })}
              type="button"
            >
              첫 휴가 계획하기
            </button>
          </section>
        ) : confirmation ? (
          <section className="m-auto w-full rounded-2xl bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-950">기존 기록 변경 확인</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">일수 변경과 선택 해제만 반영합니다. 변경하지 않는 휴가와 외출은 유지합니다.</p>
            <ul className="mt-5 space-y-3" aria-label="변경 범위">
              {getOnboardingChanges(confirmation).map((change) => (
                <li key={change.key} className="rounded-xl bg-slate-50 p-3 text-sm">
                  {items.find((item) => item.key === change.key)?.label ?? getLeaveTypeLabel(change.type)}: {change.old ? `${change.old.days}일` : '신규'} → {change.days === null ? '삭제' : `${change.days}일`}
                  {change.old && change.days !== null && <p>사용·예정 일정 {change.activeCount}건과 취소 기록 {change.canceledCount}건 유지</p>}
                  {change.old && change.days === null && <p>이 휴가와 연결된 취소 기록 {change.canceledCount}건 삭제</p>}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-slate-600">다른 휴가 {otherGrants.length}건과 외출 {state.outings.length}건은 변경하지 않습니다.</p>
            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
            <button type="button" disabled={isSaving} className="mt-5 min-h-12 w-full rounded-xl bg-brand-600 text-white" onClick={() => void savePlan(confirmation)}>변경 내용을 확인했고 저장합니다</button>
            <button type="button" disabled={isSaving} className="mt-3 min-h-12 w-full rounded-xl border border-slate-300" onClick={() => { setConfirmation(null); setError(null) }}>입력으로 돌아가기</button>
          </section>
        ) : showExistingChoice ? (
          <section className="m-auto w-full rounded-2xl bg-white p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-slate-950">기존 기록이 있어요</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">{localRecords ? '기기' : '계정'}의 휴가 {localRecords?.leaveGrants.length ?? leaveGrants.length}건·사용 일정 {localRecords?.leaveUsages.length ?? state.leaveUsages.length}건·외출 {localRecords?.outings.length ?? state.outings.length}건이 있습니다.</p>
            <p className="mt-3 text-sm leading-6 text-slate-600">이어 쓰면 기존 일수를 채워드립니다. 새로 설정하면 입력칸을 비워 다시 입력합니다. 같은 종류의 기록이 여러 건이면 각각 확인할 수 있습니다.</p>
            {localRecords ? <p className="mt-3 text-sm text-slate-600">기기의 기록을 이어 쓰면 계정으로 복사합니다. 새로 설정해도 기기의 원본은 유지합니다.</p> : <p className="mt-3 text-sm text-slate-600">기존 획득일·메모·사용 일정은 유지합니다. 일수 변경이나 삭제는 저장 전에 확인합니다.</p>}
            {error && <p role="alert" className="mt-3 text-sm text-red-600">{error}</p>}
            <button type="button" disabled={isSaving} className="mt-5 min-h-12 w-full rounded-xl bg-brand-600 text-white" onClick={() => void chooseExisting(true)}>기존 기록 이어 쓰기</button>
            <button type="button" disabled={isSaving} className="mt-3 min-h-12 w-full rounded-xl border border-slate-300" onClick={() => void chooseExisting(false)}>새로 설정하기</button>
            <button type="button" disabled={isSaving} className="mt-3 min-h-12 w-full" onClick={() => setShowExistingChoice(false)}>소개로 돌아가기</button>
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
            <header className="pb-6">
              <div className="flex items-center gap-2">
                <button
                  aria-label="이전 단계로 돌아가기"
                  className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl text-slate-600 transition-[background-color,color,transform] duration-150 ease-out hover:bg-slate-100 hover:text-slate-950 active:scale-95 active:bg-slate-200 motion-reduce:transform-none motion-reduce:transition-none"
                  disabled={isSaving}
                  onClick={() => {
                    setBranchSelected(false)
                    setError(null)
                  }}
                  type="button"
                >
                  <svg aria-hidden="true" className="size-6 fill-none stroke-current stroke-2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15 18-6-6 6-6" />
                  </svg>
                </button>
                <p className="inline-flex items-center gap-2 text-sm font-medium text-brand-600">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-blue-400" />
                  2/3 · 보유 휴가
                </p>
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">지금 가지고 있는 휴가를 알려주세요</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                먼저 보유 휴가를 등록하면 남은 휴가와 사용할 일정을 계산해드려요.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                정확하지 않아도 괜찮아요. 나중에 언제든 수정할 수 있어요.
              </p>
            </header>

            {isServerMode && serverHasRecords && <p className="mb-4 text-sm leading-6 text-slate-600">입력값은 이미 사용·계획한 휴가를 포함한 기록별 총 일수입니다. 사용·예정 일수는 그대로 차감됩니다. 기존 획득일·메모·일정은 유지합니다.</p>}
            {otherGrants.length > 0 && <p className="mb-4 text-sm text-slate-600">그대로 유지되는 휴가: {otherGrants.map((grant) => `${getLeaveTypeLabel(grant.type)} ${grant.days}일`).join(', ')}</p>}
            <form className="flex flex-1 flex-col" noValidate onSubmit={handleSubmit}>
              <div className="space-y-3">
                {items.map((item) => {
                  const visibleError = item.touched ? getDaysError(item) : null
                  return (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" key={item.key}>
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-slate-950">{item.label}</h2>
                        <p className="mt-1 text-sm text-slate-500">{isServerMode && serverHasRecords ? '사용·예정 일수를 포함한 총 일수를 입력하세요' : '현재 보유한 총 일수를 입력하세요'}</p>
                        {item.grantId && <p className="mt-1 text-xs text-slate-500">획득일 {leaveGrants.find((grant) => grant.id === item.grantId)?.acquiredDate ?? '미입력'} · {leaveGrants.find((grant) => grant.id === item.grantId)?.reason || '사유 미입력'}</p>}
                      </div>
                      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-semibold text-slate-700">
                        <input
                          aria-label={`${item.label} 등록`}
                          checked={item.included}
                          disabled={isSaving}
                          className="h-5 w-5 accent-brand-600"
                          onChange={(event) => changeItem(item.key, { included: event.target.checked })}
                          type="checkbox"
                        />
                        등록
                      </label>
                    </div>
                    {item.included && (
                      <>
                      <div className="relative mt-3">
                          <input
                            aria-label={`${item.label} 보유 일수`}
                            aria-describedby={visibleError ? `${item.key}-days-error` : undefined}
                            aria-invalid={Boolean(visibleError)}
                            className={`h-12 w-full rounded-xl border bg-white px-4 pr-12 text-base text-slate-950 outline-none focus:ring-2 ${visibleError ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'}`}
                            disabled={isSaving}
                            inputMode="numeric"
                            max={MAX_LEAVE_GRANT_DAYS}
                            min={MIN_LEAVE_GRANT_DAYS}
                            step="1"
                            onBlur={() => touchDays(item.key)}
                            onChange={(event) => changeDays(item.key, event.target.value)}
                            placeholder="일수 입력"
                            type="number"
                            value={item.days}
                          />
                          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-500">일</span>
                      </div>
                      {visibleError && (
                      <p
                        className="mt-2 text-sm leading-6 text-red-600"
                        id={`${item.key}-days-error`}
                        role="alert"
                      >
                        {visibleError}
                      </p>
                      )}
                      </>
                    )}
                  </section>
                  )
                })}
              </div>
              {selectedItems.length === 0 && otherGrants.length === 0 && <p className="mt-4 text-sm font-medium text-red-600" role="alert">저장할 휴가를 하나 이상 선택해주세요.</p>}
              {error && <p className="mt-4 text-sm font-medium text-red-600" role="alert">{error}</p>}
              <div className="mt-auto pt-8">
                <button
                  className="min-h-14 w-full rounded-xl bg-brand-600 px-5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
                  disabled={isSaving || (selectedItems.length === 0 && otherGrants.length === 0)}
                  type="submit"
                >
                  {isSaving ? '저장 중…' : '이 휴가로 시작하기'}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  )
}
