import { Link } from 'react-router'
import {
  formatCalendarDate,
  getInclusiveDayCount,
  type CalendarDate,
} from '../domain/calendarDate'
import { LeaveGrantSelect, type LeaveGrantOption } from './LeaveGrantSelect'

type LeaveUsageCreateFormProps = {
  startDate: CalendarDate
  endDate: CalendarDate
  grantId: string
  grantOptions: LeaveGrantOption[]
  errorMessage?: string
  onGrantChange: (grantId: string) => void
  onSave: () => void
  onReset: () => void
}

export function LeaveUsageCreateForm({
  startDate,
  endDate,
  grantId,
  grantOptions,
  errorMessage,
  onGrantChange,
  onSave,
  onReset,
}: LeaveUsageCreateFormProps) {
  return (
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
      {grantOptions.length > 0 ? (
        <div className="mt-5">
          <LeaveGrantSelect
            id="leave-grant"
            onChange={onGrantChange}
            options={grantOptions}
            value={grantId}
          />
          {errorMessage && (
            <p className="mt-2 text-sm font-medium text-red-600" role="alert">
              {errorMessage}
            </p>
          )}
          <button
            className="mt-4 min-h-12 w-full rounded-2xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
            onClick={onSave}
            type="button"
          >
            휴가 일정 저장
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
        onClick={onReset}
        type="button"
      >
        선택 초기화
      </button>
    </div>
  )
}
