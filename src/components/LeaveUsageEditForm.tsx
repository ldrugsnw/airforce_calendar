import {
  getInclusiveDayCount,
  type CalendarDate,
} from '../domain/calendarDate'
import { LeaveGrantSelect, type LeaveGrantOption } from './LeaveGrantSelect'

type LeaveUsageEditFormProps = {
  startDate: CalendarDate | null
  endDate: CalendarDate | null
  grantId: string
  grantOptions: LeaveGrantOption[]
  errorMessage?: string
  onStartDateChange: (date: CalendarDate | null) => void
  onEndDateChange: (date: CalendarDate | null) => void
  onGrantChange: (grantId: string) => void
  onSave: () => void
  onCancel: () => void
}

export function LeaveUsageEditForm({
  startDate,
  endDate,
  grantId,
  grantOptions,
  errorMessage,
  onStartDateChange,
  onEndDateChange,
  onGrantChange,
  onSave,
  onCancel,
}: LeaveUsageEditFormProps) {
  return (
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
            onChange={(event) =>
              onStartDateChange(
                event.target.value
                  ? (event.target.value as CalendarDate)
                  : null,
              )
            }
            type="date"
            value={startDate ?? ''}
          />
        </label>
        <label className="block min-w-0 text-sm font-semibold text-slate-800">
          종료일
          <input
            className="calendar-date-input calendar-date-input-centered mt-2 h-14 min-w-0 w-full max-w-full rounded-2xl border border-slate-300 bg-white px-4 text-base font-normal leading-6 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            min={startDate ?? undefined}
            onChange={(event) =>
              onEndDateChange(
                event.target.value ? (event.target.value as CalendarDate) : null,
              )
            }
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
      <div className="mt-5">
        <LeaveGrantSelect
          id="edit-leave-grant"
          onChange={onGrantChange}
          options={grantOptions}
          value={grantId}
        />
      </div>
      {errorMessage && (
        <p className="mt-2 text-sm font-medium text-red-600" role="alert">
          {errorMessage}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="min-h-12 rounded-2xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm"
          onClick={onSave}
          type="button"
        >
          변경사항 저장
        </button>
        <button
          className="min-h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
          onClick={onCancel}
          type="button"
        >
          수정 취소
        </button>
      </div>
    </div>
  )
}
