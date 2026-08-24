import { formatCalendarDate, type CalendarDate } from '../domain/calendarDate'

type OutingFormPanelProps = {
  date: CalendarDate
  isFormOpen: boolean
  isEditing: boolean
  reason: string
  errorMessage?: string
  onOpen: () => void
  onDateChange: (date: CalendarDate) => void
  onReasonChange: (reason: string) => void
  onSave: () => void
  onCancel: () => void
}

export function OutingFormPanel({
  date,
  isFormOpen,
  isEditing,
  reason,
  errorMessage,
  onOpen,
  onDateChange,
  onReasonChange,
  onSave,
  onCancel,
}: OutingFormPanelProps) {
  return (
    <div className="mt-2">
      <p className="font-semibold text-slate-900">{formatCalendarDate(date)}</p>
      {!isFormOpen ? (
        <>
          <p className="mt-1 text-sm text-slate-500">
            외출을 등록하거나 다른 날짜를 눌러 휴가 기간을 완성하세요.
          </p>
          <button
            className="mt-4 min-h-12 w-full rounded-2xl bg-orange-500 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600"
            onClick={onOpen}
            type="button"
          >
            {Number(date.slice(5, 7))}월 {Number(date.slice(-2))}일 외출 등록
          </button>
        </>
      ) : (
        <div className="mt-4">
          {isEditing && (
            <label
              className="block text-sm font-semibold text-slate-800"
              htmlFor="outing-date"
            >
              외출 날짜
              <input
                className="calendar-date-input calendar-date-input-centered mt-2 h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-normal text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
                id="outing-date"
                onChange={(event) => {
                  if (event.target.value) {
                    onDateChange(event.target.value as CalendarDate)
                  }
                }}
                type="date"
                value={date}
              />
            </label>
          )}
          <label
            className="block text-sm font-semibold text-slate-800"
            htmlFor="outing-reason"
          >
            외출 사유
            <input
              autoFocus={!isEditing}
              className={`${isEditing ? 'mt-4' : 'mt-2'} h-14 w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-normal text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100`}
              id="outing-reason"
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="예: 개인 용무"
              type="text"
              value={reason}
            />
          </label>
          {errorMessage && (
            <p className="mt-2 text-sm font-medium text-red-600" role="alert">
              {errorMessage}
            </p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              className="min-h-12 rounded-2xl bg-orange-500 px-4 text-sm font-semibold text-white shadow-sm"
              onClick={onSave}
              type="button"
            >
              {isEditing ? '변경사항 저장' : '외출 저장'}
            </button>
            <button
              className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
              onClick={onCancel}
              type="button"
            >
              {isEditing ? '수정 취소' : '등록 취소'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
