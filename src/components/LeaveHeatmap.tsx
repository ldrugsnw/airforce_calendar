import {
  addCalendarDays,
  formatCalendarDate,
  type CalendarDate,
} from '../domain/calendarDate'
import { LEAVE_TYPES, getLeaveTypeLabel, type LeaveGrant } from '../domain/leave'
import type { LeaveUsage } from '../domain/leaveUsage'
import { LEAVE_TYPE_HEATMAP_STYLES } from './calendarStyles'

type LeaveHeatmapProps = {
  grants: LeaveGrant[]
  usages: LeaveUsage[]
  today: CalendarDate
}

export function LeaveHeatmap({ grants, usages, today }: LeaveHeatmapProps) {
  const startDate = addCalendarDays(today, -70)
  const endDateExclusive = addCalendarDays(today, 70)
  const grantById = new Map(grants.map((grant) => [grant.id, grant]))
  const dates: CalendarDate[] = []

  for (let date = startDate; date < endDateExclusive; date = addCalendarDays(date, 1)) {
    dates.push(date)
  }

  const visibleTypes = LEAVE_TYPES.filter(({ value }) =>
    usages.some((usage) => {
      const grant = grantById.get(usage.leaveGrantId)
      return (
        !usage.canceled &&
        grant?.type === value &&
        usage.startDate < endDateExclusive &&
        startDate <= usage.endDate
      )
    }),
  )

  return (
    <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-bold text-slate-950">휴가 20주 흐름</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {formatCalendarDate(startDate)} ~ {formatCalendarDate(addCalendarDays(endDateExclusive, -1))}
      </p>
      <div className="mt-4">
        <div
          aria-label="오늘 전 10주와 오늘부터 10주의 휴가 일정"
          className="grid w-full grid-flow-col grid-rows-7 gap-0.5"
          role="grid"
          style={{ gridTemplateColumns: 'repeat(20, minmax(0, 1fr))' }}
        >
          {dates.map((date) => {
            const usage = usages.find(
              (item) => !item.canceled && item.startDate <= date && date <= item.endDate,
            )
            const grant = usage ? grantById.get(usage.leaveGrantId) : undefined
            const status = date < today ? '사용 완료' : date === today ? '오늘' : '사용 예정'
            const label = grant
              ? `${formatCalendarDate(date)}, ${getLeaveTypeLabel(grant.type)}, ${status}`
              : `${formatCalendarDate(date)}, 휴가 없음`

            return (
              <span
                aria-label={label}
                className={`aspect-square min-w-0 rounded-[0.15rem] ${
                  grant
                    ? LEAVE_TYPE_HEATMAP_STYLES[grant.type]
                    : date === today
                      ? 'bg-white ring-2 ring-brand-500'
                      : 'bg-slate-100'
                }`}
                key={date}
                role="gridcell"
                title={label}
              />
            )
          })}
        </div>
      </div>
      {visibleTypes.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-2" aria-label="휴가 잔디 범례">
          {visibleTypes.map(({ label, value }) => (
            <li className="flex items-center gap-1.5 text-xs text-slate-600" key={value}>
              <span aria-hidden="true" className={`size-2.5 rounded-sm ${LEAVE_TYPE_HEATMAP_STYLES[value]}`} />
              {label}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-xs text-slate-500">오늘 10주 전부터 오늘 이후 10주 직전까지 표시합니다.</p>
    </section>
  )
}
