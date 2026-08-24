import {
  addCalendarDays,
  type CalendarDate,
  type CalendarDay,
} from '../domain/calendarDate'
import { getLeaveTypeLabel, type LeaveGrant } from '../domain/leave'
import {
  getAvailableDays,
  type ContinuousLeaveSchedule,
  type LeaveUsage,
} from '../domain/leaveUsage'
import type { Outing } from '../domain/outing'
import type { CalendarDayItem } from './CalendarDayButton'
import type { CalendarLegendItem } from './CalendarLegend'
import type { LeaveGrantOption } from './LeaveGrantSelect'
import { LEAVE_TYPE_STYLES } from './calendarStyles'

type CalendarDayItemsInput = {
  monthGrid: Array<CalendarDay | null>
  today: CalendarDate
  startDate: CalendarDate | null
  endDate: CalendarDate | null
  leaveGrants: LeaveGrant[]
  leaveUsages: LeaveUsage[]
  outings: Outing[]
  schedules: ContinuousLeaveSchedule[]
}

function isInRange(
  date: CalendarDate,
  startDate: CalendarDate | null,
  endDate: CalendarDate | null,
) {
  if (!startDate) return false
  if (!endDate) return date === startDate
  return startDate <= date && date <= endDate
}

export function createCalendarDayItems({
  monthGrid,
  today,
  startDate,
  endDate,
  leaveGrants,
  leaveUsages,
  outings,
  schedules,
}: CalendarDayItemsInput): Array<CalendarDayItem | null> {
  return monthGrid.map((calendarDay, index) => {
    if (!calendarDay) return null

    const usage = leaveUsages.find(
      (item) =>
        !item.canceled &&
        item.startDate <= calendarDay.date &&
        calendarDay.date <= item.endDate,
    )
    const outing = outings.find(
      (item) => !item.canceled && item.date === calendarDay.date,
    )
    const leaveGrant = usage
      ? leaveGrants.find((grant) => grant.id === usage.leaveGrantId)
      : undefined
    const schedule = schedules.find(
      (item) =>
        item.startDate <= calendarDay.date && calendarDay.date <= item.endDate,
    )
    const selected = isInRange(calendarDay.date, startDate, endDate)
    const selectedConnectsPrevious =
      selected &&
      index % 7 !== 0 &&
      isInRange(addCalendarDays(calendarDay.date, -1), startDate, endDate)
    const selectedConnectsNext =
      selected &&
      index % 7 !== 6 &&
      isInRange(addCalendarDays(calendarDay.date, 1), startDate, endDate)

    return {
      connectsPrevious: Boolean(
        selected
          ? selectedConnectsPrevious
          : schedule &&
              index % 7 !== 0 &&
              schedule.startDate <= addCalendarDays(calendarDay.date, -1),
      ),
      connectsNext: Boolean(
        selected
          ? selectedConnectsNext
          : schedule &&
              index % 7 !== 6 &&
              addCalendarDays(calendarDay.date, 1) <= schedule.endDate,
      ),
      date: calendarDay.date,
      day: calendarDay.day,
      hasOuting: Boolean(outing),
      isSelected: selected,
      isToday: calendarDay.date === today,
      leaveClassName: leaveGrant
        ? LEAVE_TYPE_STYLES[leaveGrant.type]
        : undefined,
      usageLabel: leaveGrant ? getLeaveTypeLabel(leaveGrant.type) : '',
      weekdayIndex: index % 7,
    }
  })
}

export function createCalendarLegend(
  monthGrid: Array<CalendarDay | null>,
  leaveGrants: LeaveGrant[],
  leaveUsages: LeaveUsage[],
  outings: Outing[],
): { items: CalendarLegendItem[]; hasOuting: boolean } {
  const monthStart = monthGrid.find((day) => day)?.date
  const monthEnd = [...monthGrid].reverse().find((day) => day)?.date
  const isInVisibleMonth = (date: CalendarDate) =>
    monthStart !== undefined &&
    monthEnd !== undefined &&
    monthStart <= date &&
    date <= monthEnd

  const visibleGrants = leaveGrants.filter((grant) =>
    leaveUsages.some(
      (usage) =>
        !usage.canceled &&
        usage.leaveGrantId === grant.id &&
        monthStart !== undefined &&
        monthEnd !== undefined &&
        usage.startDate <= monthEnd &&
        monthStart <= usage.endDate,
    ),
  )

  return {
    items: visibleGrants.map((grant) => ({
      id: grant.id,
      label: `${getLeaveTypeLabel(grant.type)} · ${grant.reason || '사유 없음'}`,
      colorClassName: LEAVE_TYPE_STYLES[grant.type].split(' ')[0],
    })),
    hasOuting: outings.some(
      (outing) => !outing.canceled && isInVisibleMonth(outing.date),
    ),
  }
}

export function createLeaveGrantOptions(
  leaveGrants: LeaveGrant[],
  leaveUsages: LeaveUsage[],
  editingLeaveUsageId: string | null,
): LeaveGrantOption[] {
  const otherUsages = editingLeaveUsageId
    ? leaveUsages.filter((usage) => usage.id !== editingLeaveUsageId)
    : leaveUsages

  return leaveGrants
    .filter((grant) => getAvailableDays(grant, otherUsages) > 0)
    .map((grant) => ({
      id: grant.id,
      label: `${getLeaveTypeLabel(grant.type)} · ${grant.reason || '사유 없음'} · 사용 가능 ${getAvailableDays(grant, otherUsages)}일`,
    }))
}
