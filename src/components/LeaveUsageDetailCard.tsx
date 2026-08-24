import {
  formatCalendarDate,
  getInclusiveDayCount,
  type CalendarDate,
} from '../domain/calendarDate'
import { getLeaveTypeLabel, type LeaveGrant } from '../domain/leave'
import {
  getLeaveUsageStatus,
  getLeaveUsageStatusLabel,
  type ContinuousLeaveSchedule,
  type LeaveUsage,
} from '../domain/leaveUsage'
import { LEAVE_TYPE_STYLES } from './calendarStyles'

type LeaveUsageDetailCardProps = {
  usage: LeaveUsage
  grant: LeaveGrant
  schedule?: ContinuousLeaveSchedule
  leaveGrants: LeaveGrant[]
  today: CalendarDate
  onEdit: () => void
  onCancel: () => void
  onClose: () => void
}

export function LeaveUsageDetailCard({
  usage,
  grant,
  schedule,
  leaveGrants,
  today,
  onEdit,
  onCancel,
  onClose,
}: LeaveUsageDetailCardProps) {
  return (
    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      {schedule && (
        <section
          aria-labelledby="continuous-schedule-title"
          className="rounded-2xl bg-slate-950 p-4 text-white"
        >
          <p className="text-xs font-semibold text-blue-200">연결된 전체 일정</p>
          <h3
            aria-label={`${formatCalendarDate(schedule.startDate)} ~ ${formatCalendarDate(schedule.endDate)}`}
            className="mt-2 flex flex-wrap items-baseline gap-x-1.5 text-base font-bold"
            id="continuous-schedule-title"
          >
            <span className="whitespace-nowrap">
              {formatCalendarDate(schedule.startDate)}{' '}
            </span>
            <span className="whitespace-nowrap">
              ~ {formatCalendarDate(schedule.endDate)}
            </span>
          </h3>
          <p className="mt-1 text-sm text-slate-300">
            총 {schedule.totalDays}일 ·{' '}
            {schedule.composition
              .map(({ days, type }) => `${getLeaveTypeLabel(type)} ${days}일`)
              .join(' + ')}
          </p>
          <ul className="mt-3 space-y-2 border-t border-white/10 pt-3">
            {schedule.usages.map((scheduleUsage) => {
              const scheduleGrant = leaveGrants.find(
                (item) => item.id === scheduleUsage.leaveGrantId,
              )
              if (!scheduleGrant) return null

              return (
                <li
                  className="flex flex-col items-start justify-between gap-1 text-xs sm:flex-row sm:items-center sm:gap-3"
                  key={scheduleUsage.id}
                >
                  <span className="font-semibold">
                    {getLeaveTypeLabel(scheduleGrant.type)}
                    {scheduleUsage.id === usage.id && (
                      <span className="ml-1 text-blue-200">(선택한 기록)</span>
                    )}
                  </span>
                  <span className="break-words text-left text-slate-300 sm:text-right">
                    {scheduleUsage.startDate} ~ {scheduleUsage.endDate}
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
            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${LEAVE_TYPE_STYLES[grant.type]}`}
          >
            {getLeaveTypeLabel(grant.type)}
          </span>
          <span className="ml-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
            {getLeaveUsageStatusLabel(getLeaveUsageStatus(usage, today))}
          </span>
          <p className="mt-3 font-semibold text-slate-950">
            {grant.reason || '사유 없음'}
          </p>
        </div>
        <strong className="shrink-0 text-lg text-slate-950">
          {getInclusiveDayCount(usage.startDate, usage.endDate)}일
        </strong>
      </div>

      <dl className="mt-4 space-y-3 border-t border-slate-100 pt-4 text-sm">
        <div className="grid gap-1 sm:flex sm:justify-between sm:gap-4">
          <dt className="text-slate-500">사용 기간</dt>
          <dd className="flex flex-wrap items-baseline gap-x-1.5 font-medium text-slate-900 sm:justify-end sm:text-right">
            <span className="whitespace-nowrap">
              {formatCalendarDate(usage.startDate)}{' '}
            </span>
            <span className="whitespace-nowrap">
              ~ {formatCalendarDate(usage.endDate)}
            </span>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-slate-500">획득 기록</dt>
          <dd className="text-right font-medium text-slate-900">
            {grant.acquiredDate} · {grant.days}일 획득
          </dd>
        </div>
      </dl>

      {grant.memo && (
        <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          {grant.memo}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="min-h-11 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white"
          onClick={onEdit}
          type="button"
        >
          일정 수정
        </button>
        <button
          className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700"
          onClick={onCancel}
          type="button"
        >
          일정 취소
        </button>
      </div>
      <button
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 px-4 text-sm font-semibold text-slate-700"
        onClick={onClose}
        type="button"
      >
        상세 닫기
      </button>
    </div>
  )
}
