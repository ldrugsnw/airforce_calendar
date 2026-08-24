import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarMonthHeader } from '../components/CalendarMonthHeader'
import { PageHeader } from '../components/PageHeader'
import {
  addCalendarDays,
  createMonthGrid,
  formatCalendarDate,
  getCalendarMonth,
  getInclusiveDayCount,
  getKstToday,
  moveCalendarMonth,
  orderCalendarRange,
  type CalendarDate,
} from '../domain/calendarDate'
import { getLeaveTypeLabel, type LeaveType } from '../domain/leave'
import {
  createContinuousLeaveSchedules,
  getAvailableDays,
  getContinuousLeaveScheduleForUsage,
  getLeaveUsageStatus,
  getLeaveUsageStatusLabel,
  validateLeaveUsage,
  type LeaveUsage,
} from '../domain/leaveUsage'
import { validateOuting, type Outing } from '../domain/outing'
import { useAppDispatch, useAppState } from '../store/appStateContext'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

const LEAVE_TYPE_STYLES: Record<LeaveType, string> = {
  annual: 'bg-blue-600 text-white',
  reward: 'bg-red-600 text-white',
  consolation: 'bg-amber-300 text-amber-950',
  official: 'bg-violet-600 text-white',
  petition: 'bg-slate-950 text-white',
  performance: 'bg-green-600 text-white',
  other: 'bg-slate-600 text-white',
}

export function CalendarPage() {
  const { leaveGrants, leaveUsages, outings } = useAppState()
  const dispatch = useAppDispatch()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = useMemo(() => getKstToday(), [])
  const linkedLeaveUsage = leaveUsages.find(
    (usage) => usage.id === searchParams.get('usage') && !usage.canceled,
  )
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getCalendarMonth(linkedLeaveUsage?.startDate ?? today),
  )
  const [startDate, setStartDate] = useState<CalendarDate | null>(null)
  const [endDate, setEndDate] = useState<CalendarDate | null>(null)
  const [selectedLeaveUsageId, setSelectedLeaveUsageId] = useState<string | null>(
    linkedLeaveUsage?.id ?? null,
  )
  const [selectedOutingId, setSelectedOutingId] = useState<string | null>(null)
  const [editingOutingId, setEditingOutingId] = useState<string | null>(null)
  const [isOutingFormOpen, setIsOutingFormOpen] = useState(false)
  const [outingReason, setOutingReason] = useState('')
  const [editingLeaveUsageId, setEditingLeaveUsageId] = useState<string | null>(null)
  const [selectedLeaveGrantId, setSelectedLeaveGrantId] = useState('')
  const [formMessage, setFormMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const monthGrid = useMemo(() => createMonthGrid(visibleMonth), [visibleMonth])
  const visibleMonthStart = monthGrid.find((calendarDay) => calendarDay)?.date
  const visibleMonthEnd = [...monthGrid]
    .reverse()
    .find((calendarDay) => calendarDay)?.date
  const visibleMonthLegendGrants = leaveGrants.filter((grant) =>
    leaveUsages.some(
      (usage) =>
        !usage.canceled &&
        usage.leaveGrantId === grant.id &&
        visibleMonthStart !== undefined &&
        visibleMonthEnd !== undefined &&
        usage.startDate <= visibleMonthEnd &&
        visibleMonthStart <= usage.endDate,
    ),
  )
  const continuousSchedules = useMemo(
    () => createContinuousLeaveSchedules(leaveUsages, leaveGrants),
    [leaveGrants, leaveUsages],
  )
  const editingLeaveUsage = leaveUsages.find(
    (leaveUsage) => leaveUsage.id === editingLeaveUsageId && !leaveUsage.canceled,
  )
  const otherLeaveUsages = editingLeaveUsageId
    ? leaveUsages.filter((leaveUsage) => leaveUsage.id !== editingLeaveUsageId)
    : leaveUsages
  const availableLeaveGrants = leaveGrants.filter(
    (leaveGrant) => getAvailableDays(leaveGrant, otherLeaveUsages) > 0,
  )
  const selectedLeaveUsage = leaveUsages.find(
    (leaveUsage) => leaveUsage.id === selectedLeaveUsageId && !leaveUsage.canceled,
  )
  const selectedUsageGrant = selectedLeaveUsage
    ? leaveGrants.find(
        (leaveGrant) => leaveGrant.id === selectedLeaveUsage.leaveGrantId,
      )
    : undefined
  const selectedContinuousSchedule = selectedLeaveUsage
    ? getContinuousLeaveScheduleForUsage(
        continuousSchedules,
        selectedLeaveUsage.id,
      )
    : undefined
  const selectedOuting = outings.find(
    (outing) => outing.id === selectedOutingId && !outing.canceled,
  )
  const editingOuting = outings.find(
    (outing) => outing.id === editingOutingId && !outing.canceled,
  )

  function selectDate(date: CalendarDate) {
    if (editingLeaveUsageId || editingOutingId) return

    const savedUsage = getUsageForDate(date)
    const savedOuting = outings.find(
      (outing) => !outing.canceled && outing.date === date,
    )

    if (savedUsage) {
      setSelectedLeaveUsageId(savedUsage.id)
      setSearchParams({ usage: savedUsage.id }, { replace: true })
      setEditingLeaveUsageId(null)
      setSelectedOutingId(null)
      setEditingOutingId(null)
      setIsOutingFormOpen(false)
      setOutingReason('')
      setStartDate(null)
      setEndDate(null)
      setSelectedLeaveGrantId('')
      setFormMessage(null)
      return
    }

    if (savedOuting) {
      setSelectedLeaveUsageId(null)
      setSelectedOutingId(savedOuting.id)
      setEditingOutingId(null)
      setSearchParams({}, { replace: true })
      setEditingLeaveUsageId(null)
      setIsOutingFormOpen(false)
      setOutingReason('')
      setStartDate(null)
      setEndDate(null)
      setSelectedLeaveGrantId('')
      setFormMessage(null)
      return
    }

    setSelectedLeaveUsageId(null)
    setSelectedOutingId(null)
    setEditingOutingId(null)
    setIsOutingFormOpen(false)
    setOutingReason('')
    setSearchParams({}, { replace: true })
    setEditingLeaveUsageId(null)

    if (!startDate || endDate) {
      setStartDate(date)
      setEndDate(null)
      setSelectedLeaveGrantId('')
      setFormMessage(null)
      return
    }

    const range = orderCalendarRange(startDate, date)
    setStartDate(range.startDate)
    setEndDate(range.endDate)
    setFormMessage(null)
  }

  function saveOuting() {
    if (!startDate) return

    const validation = validateOuting(
      { date: startDate, reason: outingReason },
      outings,
      leaveUsages,
      editingOutingId ?? undefined,
    )

    if (!validation.valid) {
      setFormMessage({ type: 'error', text: validation.message })
      return
    }

    const now = new Date().toISOString()
    const outing: Outing = {
      id: editingOuting?.id ?? crypto.randomUUID(),
      date: startDate,
      reason: outingReason.trim(),
      canceled: editingOuting?.canceled ?? false,
      canceledAt: editingOuting?.canceledAt ?? null,
      createdAt: editingOuting?.createdAt ?? now,
      updatedAt: now,
    }

    dispatch({
      type: editingOuting ? 'outing/updated' : 'outing/added',
      payload: outing,
    })
    setSelectedOutingId(editingOuting?.id ?? null)
    setEditingOutingId(null)
    setStartDate(null)
    setIsOutingFormOpen(false)
    setOutingReason('')
    setFormMessage({
      type: 'success',
      text: editingOuting
        ? '외출 일정이 수정되었습니다.'
        : '외출 일정이 저장되었습니다.',
    })
  }

  function editSelectedOuting() {
    if (!selectedOuting) return

    setEditingOutingId(selectedOuting.id)
    setSelectedOutingId(null)
    setStartDate(selectedOuting.date)
    setEndDate(null)
    setOutingReason(selectedOuting.reason)
    setIsOutingFormOpen(true)
    setFormMessage(null)
  }

  function stopEditingOuting() {
    setSelectedOutingId(editingOutingId)
    setEditingOutingId(null)
    setStartDate(null)
    setIsOutingFormOpen(false)
    setOutingReason('')
    setFormMessage(null)
  }

  function cancelSelectedOuting() {
    if (!selectedOuting) return

    if (!window.confirm('이 외출 일정을 취소할까요?')) return

    dispatch({
      type: 'outing/canceled',
      payload: { id: selectedOuting.id, canceledAt: new Date().toISOString() },
    })
    setSelectedOutingId(null)
    setFormMessage({ type: 'success', text: '외출 일정이 취소되었습니다.' })
  }

  function getUsageForDate(date: CalendarDate) {
    return leaveUsages.find(
      (usage) => !usage.canceled && usage.startDate <= date && date <= usage.endDate,
    )
  }

  function saveLeaveUsage() {
    if (!startDate || !endDate) {
      setFormMessage({
        type: 'error',
        text: '시작일과 종료일을 모두 선택해주세요.',
      })
      return
    }

    if (endDate < startDate) {
      setFormMessage({
        type: 'error',
        text: '종료일은 시작일보다 빠를 수 없습니다.',
      })
      return
    }

    const validation = validateLeaveUsage(
      { leaveGrantId: selectedLeaveGrantId, startDate, endDate },
      leaveGrants,
      leaveUsages,
      editingLeaveUsageId ?? undefined,
      outings,
    )

    if (!validation.valid) {
      setFormMessage({ type: 'error', text: validation.message })
      return
    }

    const now = new Date().toISOString()
    const leaveUsage: LeaveUsage = {
      id: editingLeaveUsage?.id ?? crypto.randomUUID(),
      leaveGrantId: selectedLeaveGrantId,
      startDate,
      endDate,
      canceled: editingLeaveUsage?.canceled ?? false,
      canceledAt: editingLeaveUsage?.canceledAt ?? null,
      createdAt: editingLeaveUsage?.createdAt ?? now,
      updatedAt: now,
    }

    dispatch({
      type: editingLeaveUsage ? 'leaveUsage/updated' : 'leaveUsage/added',
      payload: leaveUsage,
    })
    setSelectedLeaveUsageId(null)
    setSearchParams({}, { replace: true })
    setEditingLeaveUsageId(null)
    setStartDate(null)
    setEndDate(null)
    setSelectedLeaveGrantId('')
    setFormMessage({
      type: 'success',
      text: editingLeaveUsage
        ? '휴가 사용 일정이 수정되었습니다.'
        : '휴가 사용 일정이 저장되었습니다.',
    })
  }

  function editSelectedLeaveUsage() {
    if (!selectedLeaveUsage) return

    setStartDate(selectedLeaveUsage.startDate)
    setEndDate(selectedLeaveUsage.endDate)
    setSelectedLeaveGrantId(selectedLeaveUsage.leaveGrantId)
    setEditingLeaveUsageId(selectedLeaveUsage.id)
    setSelectedLeaveUsageId(null)
    setSearchParams({}, { replace: true })
    setFormMessage(null)
  }

  function stopEditingLeaveUsage() {
    setSelectedLeaveUsageId(editingLeaveUsageId)
    if (editingLeaveUsageId) {
      setSearchParams({ usage: editingLeaveUsageId }, { replace: true })
    }
    setEditingLeaveUsageId(null)
    setStartDate(null)
    setEndDate(null)
    setSelectedLeaveGrantId('')
    setFormMessage(null)
  }

  function cancelSelectedLeaveUsage() {
    if (!selectedLeaveUsage) return

    const shouldCancel = window.confirm(
      '이 휴가 일정을 취소할까요? 취소하면 사용 가능 일수가 복구됩니다.',
    )

    if (!shouldCancel) return

    dispatch({
      type: 'leaveUsage/canceled',
      payload: { id: selectedLeaveUsage.id, canceledAt: new Date().toISOString() },
    })
    setSelectedLeaveUsageId(null)
    setSearchParams({}, { replace: true })
    setFormMessage({ type: 'success', text: '휴가 사용 일정이 취소되었습니다.' })
  }

  function isInSelectedRange(date: CalendarDate) {
    if (!startDate) return false
    if (!endDate) return date === startDate
    return date >= startDate && date <= endDate
  }

  function dismissSelectedSchedule() {
    if (editingLeaveUsageId || editingOutingId || isOutingFormOpen) return
    if (!selectedLeaveUsageId && !selectedOutingId) return

    setSelectedLeaveUsageId(null)
    setSelectedOutingId(null)
    setSearchParams({}, { replace: true })
    setFormMessage(null)
  }

  return (
    <div onClick={dismissSelectedSchedule}>
      <PageHeader
        description={'빈 날짜 한 번은 외출, 두 번은 휴가 기간을 선택해요.\n등록한 일정은 색상과 표시로 구분됩니다.'}
        title="달력"
      />
      <section
        className="mt-8 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <CalendarMonthHeader
          onNextMonth={() =>
            setVisibleMonth((month) => moveCalendarMonth(month, 1))
          }
          onPreviousMonth={() =>
            setVisibleMonth((month) => moveCalendarMonth(month, -1))
          }
          visibleMonth={visibleMonth}
        />

        <div className="mt-3 grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
          {WEEKDAYS.map((weekday, index) => (
            <div
              className={index === 0 ? 'text-red-500' : index === 6 ? 'text-blue-500' : ''}
              key={weekday}
            >
              {weekday}
            </div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-y-1">
          {monthGrid.map((calendarDay, index) => {
            if (!calendarDay) {
              return <div aria-hidden="true" className="size-10" key={`empty-${index}`} />
            }

            const usage = getUsageForDate(calendarDay.date)
            const outing = outings.find(
              (item) => !item.canceled && item.date === calendarDay.date,
            )
            const leaveGrant = usage
              ? leaveGrants.find((grant) => grant.id === usage.leaveGrantId)
              : undefined
            const usageLabel = leaveGrant ? getLeaveTypeLabel(leaveGrant.type) : ''
            const schedule = continuousSchedules.find(
              (item) => item.startDate <= calendarDay.date && calendarDay.date <= item.endDate,
            )
            const isSelected = isInSelectedRange(calendarDay.date)
            const selectedConnectsPrevious = Boolean(
              isSelected &&
              index % 7 !== 0 &&
              isInSelectedRange(addCalendarDays(calendarDay.date, -1)),
            )
            const selectedConnectsNext = Boolean(
              isSelected &&
              index % 7 !== 6 &&
              isInSelectedRange(addCalendarDays(calendarDay.date, 1)),
            )
            const connectsPrevious = Boolean(
              isSelected
                ? selectedConnectsPrevious
                : schedule &&
                    index % 7 !== 0 &&
                    schedule.startDate <= addCalendarDays(calendarDay.date, -1),
            )
            const connectsNext = Boolean(
              isSelected
                ? selectedConnectsNext
                : schedule &&
                    index % 7 !== 6 &&
                    addCalendarDays(calendarDay.date, 1) <= schedule.endDate,
            )

            return (
              <button
                aria-label={`${formatCalendarDate(calendarDay.date)}${calendarDay.date === today ? ', 오늘' : ''}${usageLabel ? `, ${usageLabel}` : ''}${outing ? ', 외출' : ''}`}
                aria-pressed={isSelected}
                className={`relative mx-auto flex h-10 w-full items-center justify-center text-sm font-medium transition ${
                  connectsPrevious ? 'rounded-l-none' : 'rounded-l-xl'
                } ${connectsNext ? 'rounded-r-none' : 'rounded-r-xl'} ${
                  isSelected
                    ? 'bg-blue-100 text-blue-950'
                    : leaveGrant
                      ? LEAVE_TYPE_STYLES[leaveGrant.type]
                    : calendarDay.date === today
                      ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-500'
                      : index % 7 === 0
                        ? 'text-red-500 hover:bg-red-50'
                        : index % 7 === 6
                          ? 'text-blue-500 hover:bg-blue-50'
                          : 'text-slate-700 hover:bg-slate-100'
                }`}
                disabled={Boolean(
                  editingLeaveUsageId || editingOutingId || isOutingFormOpen,
                )}
                key={calendarDay.date}
                onClick={() => selectDate(calendarDay.date)}
                type="button"
              >
                <span>{calendarDay.day}</span>
                {outing && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-orange-500 ring-1 ring-white"
                  />
                )}
              </button>
            )
          })}
        </div>

        {(visibleMonthLegendGrants.length > 0 ||
          outings.some(
            (outing) =>
              !outing.canceled &&
              visibleMonthStart !== undefined &&
              visibleMonthEnd !== undefined &&
              visibleMonthStart <= outing.date &&
              outing.date <= visibleMonthEnd,
          )) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {visibleMonthLegendGrants.map((grant) => (
              <span className="inline-flex max-w-full items-start gap-1.5 text-xs text-slate-600" key={grant.id}>
                <span className={`mt-0.5 size-3 shrink-0 rounded-full ${LEAVE_TYPE_STYLES[grant.type].split(' ')[0]}`} />
                <span className="min-w-0 break-words">
                  {getLeaveTypeLabel(grant.type)} · {grant.reason || '사유 없음'}
                </span>
              </span>
            ))}
            {outings.some(
              (outing) =>
                !outing.canceled &&
                visibleMonthStart !== undefined &&
                visibleMonthEnd !== undefined &&
                visibleMonthStart <= outing.date &&
                outing.date <= visibleMonthEnd,
            ) && (
              <span className="inline-flex max-w-full items-start gap-1.5 text-xs text-slate-600">
                <span className="mt-0.5 size-3 shrink-0 rounded-full bg-orange-500" />
                <span className="min-w-0 break-words">외출</span>
              </span>
            )}
          </div>
        )}
      </section>

      <section
        aria-live="polite"
        className="mt-5 rounded-3xl bg-slate-50 p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-sm font-semibold text-brand-600">
          {selectedLeaveUsage
            ? '등록된 휴가 일정'
            : selectedOuting
              ? '등록된 외출 일정'
              : editingOutingId
                ? '외출 일정 수정'
            : editingLeaveUsageId
              ? '휴가 일정 수정'
              : '선택한 휴가 기간'}
        </p>
        {selectedOuting && (
          <div className="mt-3 rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
            <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
              <span className="size-2 rounded-full bg-orange-500" />
              외출
            </span>
            <p className="mt-3 font-semibold text-slate-950">
              {selectedOuting.reason}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {formatCalendarDate(selectedOuting.date)}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="min-h-11 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white"
                onClick={editSelectedOuting}
                type="button"
              >
                외출 수정
              </button>
              <button
                className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700"
                onClick={cancelSelectedOuting}
                type="button"
              >
                외출 취소
              </button>
            </div>
            <button
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              onClick={() => setSelectedOutingId(null)}
              type="button"
            >
              상세 닫기
            </button>
          </div>
        )}
        {selectedLeaveUsage && selectedUsageGrant && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            {selectedContinuousSchedule && (
              <section
                aria-labelledby="continuous-schedule-title"
                className="rounded-2xl bg-slate-950 p-4 text-white"
              >
                <p className="text-xs font-semibold text-blue-200">연결된 전체 일정</p>
                <h3
                  aria-label={`${formatCalendarDate(selectedContinuousSchedule.startDate)} ~ ${formatCalendarDate(selectedContinuousSchedule.endDate)}`}
                  className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-base font-bold"
                  id="continuous-schedule-title"
                >
                  <span className="whitespace-nowrap">
                    {formatCalendarDate(selectedContinuousSchedule.startDate)}{' '}
                  </span>
                  <span className="whitespace-nowrap">
                    ~ {formatCalendarDate(selectedContinuousSchedule.endDate)}
                  </span>
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  총 {selectedContinuousSchedule.totalDays}일 ·{' '}
                  {selectedContinuousSchedule.composition
                    .map(
                      ({ days, type }) =>
                        `${getLeaveTypeLabel(type)} ${days}일`,
                    )
                    .join(' + ')}
                </p>
                <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
                  {selectedContinuousSchedule.usages.map((usage) => {
                    const grant = leaveGrants.find(
                      (item) => item.id === usage.leaveGrantId,
                    )
                    if (!grant) return null

                    return (
                      <li
                        className="flex flex-col items-start justify-between gap-1 text-xs sm:flex-row sm:items-center sm:gap-3"
                        key={usage.id}
                      >
                        <span className="font-semibold">
                          {getLeaveTypeLabel(grant.type)}
                          {usage.id === selectedLeaveUsage.id && (
                            <span className="ml-1 text-blue-200">(선택한 기록)</span>
                          )}
                        </span>
                        <span className="break-words text-left text-slate-300 sm:text-right">
                          {usage.startDate} ~ {usage.endDate}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            <div className="mt-5 flex items-start justify-between gap-3">
              <div>
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${LEAVE_TYPE_STYLES[selectedUsageGrant.type]}`}
                >
                  {getLeaveTypeLabel(selectedUsageGrant.type)}
                </span>
                <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {getLeaveUsageStatusLabel(
                    getLeaveUsageStatus(selectedLeaveUsage, today),
                  )}
                </span>
                <p className="mt-3 font-semibold text-slate-950">
                  {selectedUsageGrant.reason || '사유 없음'}
                </p>
              </div>
              <strong className="shrink-0 text-lg text-slate-950">
                {getInclusiveDayCount(
                  selectedLeaveUsage.startDate,
                  selectedLeaveUsage.endDate,
                )}
                일
              </strong>
            </div>
            <dl className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
              <div className="grid gap-1 sm:flex sm:justify-between sm:gap-4">
                <dt className="text-slate-500">사용 기간</dt>
                <dd className="flex flex-wrap items-baseline gap-x-1.5 font-medium text-slate-900 sm:justify-end sm:text-right">
                  <span className="whitespace-nowrap">
                    {formatCalendarDate(selectedLeaveUsage.startDate)}{' '}
                  </span>
                  <span className="whitespace-nowrap">
                    ~ {formatCalendarDate(selectedLeaveUsage.endDate)}
                  </span>
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">획득 기록</dt>
                <dd className="text-right font-medium text-slate-900">
                  {selectedUsageGrant.acquiredDate} · {selectedUsageGrant.days}일 획득
                </dd>
              </div>
            </dl>
            {selectedUsageGrant.memo && (
              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                {selectedUsageGrant.memo}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white"
                onClick={editSelectedLeaveUsage}
                type="button"
              >
                일정 수정
              </button>
              <button
                className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700"
                onClick={cancelSelectedLeaveUsage}
                type="button"
              >
                일정 취소
              </button>
            </div>
            <button
              className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              onClick={() => {
                setSelectedLeaveUsageId(null)
                setSearchParams({}, { replace: true })
              }}
              type="button"
            >
              상세 닫기
            </button>
          </div>
        )}
        {editingLeaveUsageId && editingLeaveUsage && (
          <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm leading-6 text-slate-600">
              시작일과 종료일을 바꾸면 주말과 공휴일을 포함한 총일수가 자동으로 계산됩니다.
            </p>
            <div className="mt-4 grid min-w-0 grid-cols-1 gap-4">
              <label className="block min-w-0 text-sm font-semibold text-slate-800">
                시작일
                <input
                  className="calendar-date-input calendar-date-input-centered mt-2 h-14 min-w-0 w-full max-w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-normal leading-6 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  max={endDate ?? undefined}
                  onChange={(event) => {
                    setStartDate(
                      event.target.value
                        ? (event.target.value as CalendarDate)
                        : null,
                    )
                    setFormMessage(null)
                  }}
                  type="date"
                  value={startDate ?? ''}
                />
              </label>
              <label className="block min-w-0 text-sm font-semibold text-slate-800">
                종료일
                <input
                  className="calendar-date-input calendar-date-input-centered mt-2 h-14 min-w-0 w-full max-w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-normal leading-6 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  min={startDate ?? undefined}
                  onChange={(event) => {
                    setEndDate(
                      event.target.value
                        ? (event.target.value as CalendarDate)
                        : null,
                    )
                    setFormMessage(null)
                  }}
                  type="date"
                  value={endDate ?? ''}
                />
              </label>
            </div>
            <div className="mt-4 rounded-2xl bg-blue-50 p-4">
              <p className="text-xs font-semibold text-blue-700">변경할 휴가 일수</p>
              <p className="mt-1 text-2xl font-bold text-blue-950">
                {startDate && endDate && startDate <= endDate
                  ? `${getInclusiveDayCount(startDate, endDate)}일`
                  : '날짜를 확인해주세요'}
              </p>
            </div>
            <label className="mt-5 block min-w-0 text-sm font-semibold text-slate-800" htmlFor="edit-leave-grant">
              사용할 보유 휴가
              <span className="relative mt-2 block min-w-0 w-full">
                <select
                  className="h-14 min-w-0 w-full max-w-full appearance-none rounded-2xl border border-slate-300 bg-white px-4 pr-12 text-base leading-6 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                  id="edit-leave-grant"
                  onChange={(event) => {
                    setSelectedLeaveGrantId(event.target.value)
                    setFormMessage(null)
                  }}
                  value={selectedLeaveGrantId}
                >
                  <option value="">보유 휴가를 선택하세요</option>
                  {availableLeaveGrants.map((leaveGrant) => (
                    <option key={leaveGrant.id} value={leaveGrant.id}>
                      {getLeaveTypeLabel(leaveGrant.type)} · {leaveGrant.reason || '사유 없음'} · 사용 가능 {getAvailableDays(leaveGrant, otherLeaveUsages)}일
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </span>
            </label>
            {formMessage?.type === 'error' && (
              <p className="mt-2 text-sm font-medium text-red-600" role="alert">
                {formMessage.text}
              </p>
            )}
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                className="min-h-12 rounded-2xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm"
                onClick={saveLeaveUsage}
                type="button"
              >
                변경사항 저장
              </button>
              <button
                className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                onClick={stopEditingLeaveUsage}
                type="button"
              >
                수정 취소
              </button>
            </div>
          </div>
        )}
        {!selectedLeaveUsage && !selectedOuting && !editingLeaveUsageId && !editingOutingId && !startDate && (
          <p className="mt-2 text-sm leading-6 text-slate-500">
            빈 날짜를 눌러 시작일과 종료일을 선택하세요. 등록된 날짜를 누르면 일정 상세를 볼 수 있어요.
          </p>
        )}
        {!editingLeaveUsageId && startDate && !endDate && (
          <div className="mt-2">
            <p className="font-semibold text-slate-900">{formatCalendarDate(startDate)}</p>
            {!isOutingFormOpen ? (
              <>
                <p className="mt-1 text-sm text-slate-500">
                  외출을 등록하거나 다른 날짜를 눌러 휴가 기간을 완성하세요.
                </p>
                <button
                  className="mt-4 min-h-12 w-full rounded-2xl bg-orange-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
                  onClick={() => {
                    setIsOutingFormOpen(true)
                    setFormMessage(null)
                  }}
                  type="button"
                >
                  {visibleMonth.month}월 {Number(startDate.slice(-2))}일 외출 등록
                </button>
              </>
            ) : (
              <div className="mt-4">
                {editingOutingId && (
                  <label className="block text-sm font-semibold text-slate-800" htmlFor="outing-date">
                    외출 날짜
                    <input
                      className="calendar-date-input calendar-date-input-centered mt-2 h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-normal text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                      id="outing-date"
                      onChange={(event) => {
                        if (event.target.value) {
                          setStartDate(event.target.value as CalendarDate)
                        }
                        setFormMessage(null)
                      }}
                      type="date"
                      value={startDate}
                    />
                  </label>
                )}
                <label className="block text-sm font-semibold text-slate-800" htmlFor="outing-reason">
                  외출 사유
                  <input
                    autoFocus={!editingOutingId}
                    className={`${editingOutingId ? 'mt-4' : 'mt-2'} h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-normal text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100`}
                    id="outing-reason"
                    onChange={(event) => {
                      setOutingReason(event.target.value)
                      setFormMessage(null)
                    }}
                    placeholder="예: 개인 용무"
                    type="text"
                    value={outingReason}
                  />
                </label>
                {formMessage?.type === 'error' && (
                  <p className="mt-2 text-sm font-medium text-red-600" role="alert">
                    {formMessage.text}
                  </p>
                )}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    className="min-h-12 rounded-2xl bg-orange-500 px-4 text-sm font-semibold text-white shadow-sm"
                    onClick={saveOuting}
                    type="button"
                  >
                    {editingOutingId ? '변경사항 저장' : '외출 저장'}
                  </button>
                  <button
                    className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
                    onClick={editingOutingId ? stopEditingOuting : () => {
                      setIsOutingFormOpen(false)
                      setOutingReason('')
                      setFormMessage(null)
                    }}
                    type="button"
                  >
                    {editingOutingId ? '수정 취소' : '등록 취소'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        {!editingLeaveUsageId && startDate && endDate && (
          <div className="mt-2">
            <p className="flex flex-wrap items-baseline gap-x-1.5 font-semibold text-slate-900">
              <span className="whitespace-nowrap">
                {formatCalendarDate(startDate)}{' '}
              </span>
              <span className="whitespace-nowrap">
                ~ {formatCalendarDate(endDate)}
              </span>
            </p>
            <p className="mt-1 text-sm text-slate-500">
              주말과 공휴일을 포함해 총{' '}
              <strong className="text-brand-700">
                {getInclusiveDayCount(startDate, endDate)}일
              </strong>
              이에요.
            </p>
            {availableLeaveGrants.length > 0 ? (
              <div className="mt-5">
                <label className="block min-w-0 text-sm font-semibold text-slate-800" htmlFor="leave-grant">
                  사용할 보유 휴가
                  <span className="relative mt-2 block min-w-0 w-full">
                    <select
                      className="h-14 min-w-0 w-full max-w-full appearance-none rounded-2xl border border-slate-300 bg-white px-4 pr-12 text-base leading-6 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      id="leave-grant"
                      onChange={(event) => {
                        setSelectedLeaveGrantId(event.target.value)
                        setFormMessage(null)
                      }}
                      value={selectedLeaveGrantId}
                    >
                      <option value="">보유 휴가를 선택하세요</option>
                      {availableLeaveGrants.map((leaveGrant) => (
                        <option key={leaveGrant.id} value={leaveGrant.id}>
                          {getLeaveTypeLabel(leaveGrant.type)} · {leaveGrant.reason || '사유 없음'} · 사용 가능 {getAvailableDays(leaveGrant, leaveUsages)}일
                        </option>
                      ))}
                    </select>
                    <SelectChevron />
                  </span>
                </label>
                {formMessage?.type === 'error' && (
                  <p className="mt-2 text-sm font-medium text-red-600" role="alert">
                    {formMessage.text}
                  </p>
                )}
                <button
                  className="mt-4 min-h-12 w-full rounded-2xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
                  onClick={saveLeaveUsage}
                  type="button"
                >
                  {editingLeaveUsageId ? '휴가 일정 수정' : '휴가 일정 저장'}
                </button>
              </div>
            ) : (
              <p className="mt-4 text-sm leading-6 text-slate-600">
                사용할 수 있는 보유 휴가가 없습니다.{' '}
                <Link className="font-semibold text-brand-700 underline" to="/leave/new">
                  보유 휴가 추가
                </Link>
              </p>
            )}
            <button
              className="mt-4 min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              onClick={() => {
                setStartDate(null)
                setEndDate(null)
                setSelectedLeaveGrantId('')
                setEditingLeaveUsageId(null)
                setFormMessage(null)
              }}
              type="button"
            >
              선택 초기화
            </button>
          </div>
        )}
        {!startDate && formMessage?.type === 'success' && (
          <p className="mt-2 text-sm font-semibold text-emerald-700" role="status">
            {formMessage.text}
          </p>
        )}
      </section>
    </div>
  )
}

function SelectChevron() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-500"
      fill="none"
      viewBox="0 0 20 20"
    >
      <path
        d="m6 8 4 4 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
  )
}
