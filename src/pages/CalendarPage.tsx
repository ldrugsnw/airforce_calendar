import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { CalendarGrid } from '../components/CalendarGrid'
import { CalendarLegend } from '../components/CalendarLegend'
import { CalendarMonthHeader } from '../components/CalendarMonthHeader'
import { LeaveUsageDetailCard } from '../components/LeaveUsageDetailCard'
import { LeaveUsageCreateForm } from '../components/LeaveUsageCreateForm'
import { LeaveUsageEditForm } from '../components/LeaveUsageEditForm'
import { OutingDetailCard } from '../components/OutingDetailCard'
import { OutingFormPanel } from '../components/OutingFormPanel'
import {
  createCalendarDayItems,
  createCalendarLegend,
  createLeaveGrantOptions,
} from '../components/calendarViewModel'
import { PageHeader } from '../components/PageHeader'
import {
  createMonthGrid,
  getCalendarMonth,
  getKstToday,
  isCalendarDate,
  moveCalendarMonth,
  orderCalendarRange,
  type CalendarDate,
} from '../domain/calendarDate'
import {
  createContinuousLeaveSchedules,
  getContinuousLeaveScheduleForUsage,
  validateLeaveUsage,
  type LeaveUsage,
} from '../domain/leaveUsage'
import { validateOuting, type Outing } from '../domain/outing'
import { useAppDispatch, useAppState } from '../store/appStateContext'

export function CalendarPage() {
  const { leaveGrants, leaveUsages, outings } = useAppState()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const today = useMemo(() => getKstToday(), [])
  const linkedStartDate = isCalendarDate(searchParams.get('start'))
    ? searchParams.get('start') as CalendarDate
    : null
  const linkedLeaveUsage = leaveUsages.find(
    (usage) => usage.id === searchParams.get('usage') && !usage.canceled,
  )
  const [visibleMonth, setVisibleMonth] = useState(() =>
    getCalendarMonth(linkedLeaveUsage?.startDate ?? linkedStartDate ?? today),
  )
  const [startDate, setStartDate] = useState<CalendarDate | null>(linkedStartDate)
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
  const [interactionMode, setInteractionMode] = useState<'leave' | 'outing'>('leave')
  const [formMessage, setFormMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null)
  const monthGrid = useMemo(() => createMonthGrid(visibleMonth), [visibleMonth])
  const legend = createCalendarLegend(
    monthGrid,
    leaveGrants,
    leaveUsages,
    outings,
  )
  const continuousSchedules = useMemo(
    () => createContinuousLeaveSchedules(leaveUsages, leaveGrants),
    [leaveGrants, leaveUsages],
  )
  const editingLeaveUsage = leaveUsages.find(
    (leaveUsage) => leaveUsage.id === editingLeaveUsageId && !leaveUsage.canceled,
  )
  const availableLeaveGrantOptions = createLeaveGrantOptions(
    leaveGrants,
    leaveUsages,
    editingLeaveUsageId,
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
      setInteractionMode('leave')
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
      setInteractionMode('outing')
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

    if (interactionMode === 'outing') {
      setStartDate(date)
      setEndDate(null)
      setIsOutingFormOpen(true)
      setFormMessage(null)
      return
    }

    if (leaveGrants.length === 0) {
      const returnTo = `/calendar?start=${date}`
      navigate(`/leave/new?returnTo=${encodeURIComponent(returnTo)}`)
      return
    }

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

  async function saveOuting() {
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

    const result = await dispatch({
      type: editingOuting ? 'outing/updated' : 'outing/added',
      payload: outing,
    })
    if (!result.ok) {
      setFormMessage({ type: 'error', text: result.message })
      return
    }
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

  async function cancelSelectedOuting() {
    if (!selectedOuting) return

    if (!window.confirm('이 외출 일정을 취소할까요?')) return

    const result = await dispatch({
      type: 'outing/canceled',
      payload: { id: selectedOuting.id, canceledAt: new Date().toISOString() },
    })
    if (!result.ok) {
      setFormMessage({ type: 'error', text: result.message })
      return
    }
    setSelectedOutingId(null)
    setFormMessage({ type: 'success', text: '외출 일정이 취소되었습니다.' })
  }

  function getUsageForDate(date: CalendarDate) {
    return leaveUsages.find(
      (usage) => !usage.canceled && usage.startDate <= date && date <= usage.endDate,
    )
  }

  async function saveLeaveUsage() {
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

    const result = await dispatch({
      type: editingLeaveUsage ? 'leaveUsage/updated' : 'leaveUsage/added',
      payload: leaveUsage,
    })
    if (!result.ok) {
      setFormMessage({ type: 'error', text: result.message })
      return
    }
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

  function resetLeaveUsageSelection() {
    setStartDate(null)
    setEndDate(null)
    setSelectedLeaveGrantId('')
    setEditingLeaveUsageId(null)
    setFormMessage(null)
  }

  async function cancelSelectedLeaveUsage() {
    if (!selectedLeaveUsage) return

    const shouldCancel = window.confirm(
      '이 휴가 일정을 취소할까요? 취소하면 사용 가능 일수가 복구됩니다.',
    )

    if (!shouldCancel) return

    const result = await dispatch({
      type: 'leaveUsage/canceled',
      payload: { id: selectedLeaveUsage.id, canceledAt: new Date().toISOString() },
    })
    if (!result.ok) {
      setFormMessage({ type: 'error', text: result.message })
      return
    }
    setSelectedLeaveUsageId(null)
    setSearchParams({}, { replace: true })
    setFormMessage({ type: 'success', text: '휴가 사용 일정이 취소되었습니다.' })
  }

  function dismissSelectedSchedule() {
    if (editingLeaveUsageId || editingOutingId || isOutingFormOpen) return
    if (!selectedLeaveUsageId && !selectedOutingId) return

    setSelectedLeaveUsageId(null)
    setSelectedOutingId(null)
    setSearchParams({}, { replace: true })
    setFormMessage(null)
  }

  const calendarDays = createCalendarDayItems({
    monthGrid,
    today,
    startDate,
    endDate,
    leaveGrants,
    leaveUsages,
    outings,
    schedules: continuousSchedules,
  })

  return (
    <div onClick={dismissSelectedSchedule}>
      <PageHeader
        description="먼저 휴가와 외출 중 등록할 일정을 고른 뒤 날짜를 선택하세요."
        title="달력"
      />
      <div
        aria-label="등록할 일정 종류"
        className="mt-6 grid grid-cols-2 rounded-2xl bg-slate-100 p-1"
        role="group"
      >
        {([
          ['leave', '휴가'],
          ['outing', '외출'],
        ] as const).map(([mode, label]) => (
          <button
            aria-pressed={interactionMode === mode}
            className={`min-h-11 rounded-xl text-sm font-semibold transition ${
              interactionMode === mode
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-600'
            }`}
            key={mode}
            onClick={() => {
              setInteractionMode(mode)
              resetLeaveUsageSelection()
              setIsOutingFormOpen(false)
              setOutingReason('')
            }}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      {!editingLeaveUsageId && !editingOutingId && (
        <section
          aria-live="polite"
          className="mt-3 rounded-2xl border border-brand-100 bg-brand-50 px-4 py-3"
          onClick={(event) => event.stopPropagation()}
        >
          {interactionMode === 'leave' ? (
            startDate && !endDate ? (
              <>
                <p className="font-bold text-brand-800">② 종료일 선택</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  시작일은 {startDate}입니다. 하루 휴가라면 같은 날을 다시 누르세요.
                </p>
                <button
                  className="mt-2 min-h-10 rounded-xl border border-brand-200 bg-white px-3 text-sm font-semibold text-brand-700"
                  onClick={resetLeaveUsageSelection}
                  type="button"
                >
                  선택 취소
                </button>
              </>
            ) : (
              <>
                <p className="font-bold text-brand-800">① 시작일 선택</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">
                  달력에서 휴가를 시작할 날짜를 누르세요.
                </p>
              </>
            )
          ) : (
            <>
              <p className="font-bold text-brand-800">외출 날짜 선택</p>
              <p className="mt-1 text-sm leading-6 text-slate-700">
                외출은 하루만 선택합니다. 달력에서 외출할 날짜를 누르세요.
              </p>
            </>
          )}
        </section>
      )}
      <section
        className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        onClick={(event) => event.stopPropagation()}
      >
        <CalendarMonthHeader
          onMonthJump={setVisibleMonth}
          onNextMonth={() =>
            setVisibleMonth((month) => moveCalendarMonth(month, 1))
          }
          onPreviousMonth={() =>
            setVisibleMonth((month) => moveCalendarMonth(month, -1))
          }
          onToday={() => setVisibleMonth(getCalendarMonth(today))}
          visibleMonth={visibleMonth}
        />

        <CalendarGrid
          days={calendarDays}
          disabled={Boolean(
            editingLeaveUsageId || editingOutingId || isOutingFormOpen,
          )}
          onSelectDate={selectDate}
        />

        <CalendarLegend hasOuting={legend.hasOuting} items={legend.items} />
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
          <LeaveUsageEditForm
            endDate={endDate}
            errorMessage={
              formMessage?.type === 'error' ? formMessage.text : undefined
            }
            grantId={selectedLeaveGrantId}
            grantOptions={availableLeaveGrantOptions}
            onCancel={stopEditingLeaveUsage}
            onEndDateChange={(date) => {
              setEndDate(date)
              setFormMessage(null)
            }}
            onGrantChange={(grantId) => {
              setSelectedLeaveGrantId(grantId)
              setFormMessage(null)
            }}
            onSave={saveLeaveUsage}
            onStartDateChange={(date) => {
              setStartDate(date)
              setFormMessage(null)
            }}
            startDate={startDate}
          />
        )}
        {!selectedLeaveUsage && !selectedOuting && !editingLeaveUsageId && !editingOutingId && !startDate && (
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {interactionMode === 'leave'
              ? '휴가 시작일을 선택하세요. 등록된 날짜를 누르면 일정 상세를 볼 수 있어요.'
              : '외출할 하루를 선택하세요. 등록된 날짜를 누르면 일정 상세를 볼 수 있어요.'}
          </p>
        )}
        {interactionMode === 'leave' && !editingLeaveUsageId && startDate && !endDate && (
          <div className="mt-2">
            <p className="font-semibold text-slate-900">{startDate}</p>
          </div>
        )}
        {interactionMode === 'outing' && !editingLeaveUsageId && startDate && !endDate && (
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
        {interactionMode === 'leave' && !editingLeaveUsageId && startDate && endDate && (
          <LeaveUsageCreateForm
            endDate={endDate}
            errorMessage={
              formMessage?.type === 'error' ? formMessage.text : undefined
            }
            grantId={selectedLeaveGrantId}
            grantOptions={availableLeaveGrantOptions}
            onGrantChange={(grantId) => {
              setSelectedLeaveGrantId(grantId)
              setFormMessage(null)
            }}
            onReset={resetLeaveUsageSelection}
            onSave={saveLeaveUsage}
            startDate={startDate}
          />
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
