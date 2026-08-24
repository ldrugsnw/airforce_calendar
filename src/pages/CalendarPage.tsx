import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { CalendarGrid } from '../components/CalendarGrid'
import { CalendarLegend } from '../components/CalendarLegend'
import { CalendarMonthHeader } from '../components/CalendarMonthHeader'
import { LeaveUsageDetailCard } from '../components/LeaveUsageDetailCard'
import { OutingDetailCard } from '../components/OutingDetailCard'
import { OutingFormPanel } from '../components/OutingFormPanel'
import { LEAVE_TYPE_STYLES } from '../components/calendarStyles'
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
import { getLeaveTypeLabel } from '../domain/leave'
import {
  createContinuousLeaveSchedules,
  getAvailableDays,
  getContinuousLeaveScheduleForUsage,
  validateLeaveUsage,
  type LeaveUsage,
} from '../domain/leaveUsage'
import { validateOuting, type Outing } from '../domain/outing'
import { useAppDispatch, useAppState } from '../store/appStateContext'

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
  const hasVisibleMonthOuting = outings.some(
    (outing) =>
      !outing.canceled &&
      visibleMonthStart !== undefined &&
      visibleMonthEnd !== undefined &&
      visibleMonthStart <= outing.date &&
      outing.date <= visibleMonthEnd,
  )
  const legendItems = visibleMonthLegendGrants.map((grant) => ({
    id: grant.id,
    label: `${getLeaveTypeLabel(grant.type)} · ${grant.reason || '사유 없음'}`,
    colorClassName: LEAVE_TYPE_STYLES[grant.type].split(' ')[0],
  }))
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

  function closeOutingForm() {
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

  const calendarDays = monthGrid.map((calendarDay, index) => {
    if (!calendarDay) return null

    const usage = getUsageForDate(calendarDay.date)
    const outing = outings.find(
      (item) => !item.canceled && item.date === calendarDay.date,
    )
    const leaveGrant = usage
      ? leaveGrants.find((grant) => grant.id === usage.leaveGrantId)
      : undefined
    const usageLabel = leaveGrant ? getLeaveTypeLabel(leaveGrant.type) : ''
    const schedule = continuousSchedules.find(
      (item) =>
        item.startDate <= calendarDay.date && calendarDay.date <= item.endDate,
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

    return {
      connectsPrevious: Boolean(
        isSelected
          ? selectedConnectsPrevious
          : schedule &&
              index % 7 !== 0 &&
              schedule.startDate <= addCalendarDays(calendarDay.date, -1),
      ),
      connectsNext: Boolean(
        isSelected
          ? selectedConnectsNext
          : schedule &&
              index % 7 !== 6 &&
              addCalendarDays(calendarDay.date, 1) <= schedule.endDate,
      ),
      date: calendarDay.date,
      day: calendarDay.day,
      hasOuting: Boolean(outing),
      isSelected,
      isToday: calendarDay.date === today,
      leaveClassName: leaveGrant
        ? LEAVE_TYPE_STYLES[leaveGrant.type]
        : undefined,
      usageLabel,
      weekdayIndex: index % 7,
    }
  })

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

        <CalendarGrid
          days={calendarDays}
          disabled={Boolean(
            editingLeaveUsageId || editingOutingId || isOutingFormOpen,
          )}
          onSelectDate={selectDate}
        />

        <CalendarLegend hasOuting={hasVisibleMonthOuting} items={legendItems} />
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
          <OutingDetailCard
            onCancel={cancelSelectedOuting}
            onClose={() => setSelectedOutingId(null)}
            onEdit={editSelectedOuting}
            outing={selectedOuting}
          />
        )}
        {selectedLeaveUsage && selectedUsageGrant && (
          <LeaveUsageDetailCard
            grant={selectedUsageGrant}
            leaveGrants={leaveGrants}
            onCancel={cancelSelectedLeaveUsage}
            onClose={() => {
              setSelectedLeaveUsageId(null)
              setSearchParams({}, { replace: true })
            }}
            onEdit={editSelectedLeaveUsage}
            schedule={selectedContinuousSchedule}
            today={today}
            usage={selectedLeaveUsage}
          />
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
          <OutingFormPanel
            date={startDate}
            errorMessage={
              formMessage?.type === 'error' ? formMessage.text : undefined
            }
            isEditing={Boolean(editingOutingId)}
            isFormOpen={isOutingFormOpen}
            onCancel={editingOutingId ? stopEditingOuting : closeOutingForm}
            onDateChange={(date) => {
              setStartDate(date)
              setFormMessage(null)
            }}
            onOpen={() => {
              setIsOutingFormOpen(true)
              setFormMessage(null)
            }}
            onReasonChange={(reason) => {
              setOutingReason(reason)
              setFormMessage(null)
            }}
            onSave={saveOuting}
            reason={outingReason}
          />
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
