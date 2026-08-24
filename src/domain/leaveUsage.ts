import {
  addCalendarDays,
  getCalendarDayDifference,
  getInclusiveDayCount,
  type CalendarDate,
} from './calendarDate'
import type { LeaveGrant, LeaveType } from './leave'
import type { Outing } from './outing'

export type LeaveUsage = {
  id: string
  leaveGrantId: string
  startDate: CalendarDate
  endDate: CalendarDate
  canceled: boolean
  canceledAt: string | null
  createdAt: string
  updatedAt: string
  revision?: number
}

export type LeaveUsageStatus = 'scheduled' | 'inProgress' | 'completed'

export type LeaveGrantSummary = {
  totalDays: number
  completedDays: number
  inProgressDays: number
  scheduledDays: number
  availableDays: number
}

export type ContinuousLeaveComposition = {
  type: LeaveType
  days: number
}

export type ContinuousLeaveSchedule = {
  startDate: CalendarDate
  endDate: CalendarDate
  totalDays: number
  usages: LeaveUsage[]
  composition: ContinuousLeaveComposition[]
}

export type LeaveUsageValidation =
  | { valid: true }
  | {
      valid: false
      reason:
        | 'leaveGrantNotFound'
        | 'insufficientDays'
        | 'overlap'
        | 'outingOverlap'
      message: string
    }

export function getLeaveUsageDays(leaveUsage: LeaveUsage) {
  return getInclusiveDayCount(leaveUsage.startDate, leaveUsage.endDate)
}

export function createContinuousLeaveSchedules(
  leaveUsages: LeaveUsage[],
  leaveGrants: LeaveGrant[],
): ContinuousLeaveSchedule[] {
  const grantById = new Map(leaveGrants.map((grant) => [grant.id, grant]))
  const sortedUsages = leaveUsages
    .filter((usage) => !usage.canceled && grantById.has(usage.leaveGrantId))
    .sort((first, second) =>
      first.startDate.localeCompare(second.startDate),
    )
  const usageGroups: LeaveUsage[][] = []

  for (const usage of sortedUsages) {
    const currentGroup = usageGroups.at(-1)
    const previousUsage = currentGroup?.at(-1)

    if (
      currentGroup &&
      previousUsage &&
      usage.startDate === addCalendarDays(previousUsage.endDate, 1)
    ) {
      currentGroup.push(usage)
    } else {
      usageGroups.push([usage])
    }
  }

  return usageGroups.map((usages) => {
    const composition = usages.reduce<ContinuousLeaveComposition[]>(
      (items, usage) => {
        const type = grantById.get(usage.leaveGrantId)?.type
        if (!type) return items

        const existing = items.find((item) => item.type === type)
        if (existing) {
          existing.days += getLeaveUsageDays(usage)
        } else {
          items.push({ type, days: getLeaveUsageDays(usage) })
        }
        return items
      },
      [],
    )
    const startDate = usages[0].startDate
    const endDate = usages.at(-1)?.endDate ?? startDate

    return {
      startDate,
      endDate,
      totalDays: getInclusiveDayCount(startDate, endDate),
      usages,
      composition,
    }
  })
}

export function getCurrentAndNextLeaveSchedules(
  schedules: ContinuousLeaveSchedule[],
  today: CalendarDate,
) {
  const currentSchedule = schedules.find(
    (schedule) => schedule.startDate <= today && today <= schedule.endDate,
  )
  const nextSchedule = schedules.find((schedule) => schedule.startDate > today)

  return { currentSchedule, nextSchedule }
}

export function getContinuousLeaveScheduleForUsage(
  schedules: ContinuousLeaveSchedule[],
  leaveUsageId: string,
) {
  return schedules.find((schedule) =>
    schedule.usages.some((usage) => usage.id === leaveUsageId),
  )
}

export function getLeaveScheduleDday(
  schedule: ContinuousLeaveSchedule,
  today: CalendarDate,
) {
  return getCalendarDayDifference(today, schedule.startDate)
}

export function getLeaveUsageStatus(
  leaveUsage: LeaveUsage,
  today: CalendarDate,
): LeaveUsageStatus {
  if (today < leaveUsage.startDate) return 'scheduled'
  if (today <= leaveUsage.endDate) return 'inProgress'
  return 'completed'
}

export function getLeaveUsageStatusLabel(status: LeaveUsageStatus) {
  const labels: Record<LeaveUsageStatus, string> = {
    scheduled: '사용 예정',
    inProgress: '휴가 중',
    completed: '사용 완료',
  }

  return labels[status]
}

export function getLeaveGrantSummary(
  leaveGrant: LeaveGrant,
  leaveUsages: LeaveUsage[],
  today: CalendarDate,
): LeaveGrantSummary {
  const activeUsages = leaveUsages.filter(
    (usage) => usage.leaveGrantId === leaveGrant.id && !usage.canceled,
  )

  return activeUsages.reduce<LeaveGrantSummary>(
    (summary, usage) => {
      const usageDays = getLeaveUsageDays(usage)
      const status = getLeaveUsageStatus(usage, today)

      return {
        ...summary,
        completedDays:
          summary.completedDays + (status === 'completed' ? usageDays : 0),
        inProgressDays:
          summary.inProgressDays + (status === 'inProgress' ? usageDays : 0),
        scheduledDays:
          summary.scheduledDays + (status === 'scheduled' ? usageDays : 0),
        availableDays: summary.availableDays - usageDays,
      }
    },
    {
      totalDays: leaveGrant.days,
      completedDays: 0,
      inProgressDays: 0,
      scheduledDays: 0,
      availableDays: leaveGrant.days,
    },
  )
}

export function getUsedDaysForGrant(
  leaveGrantId: string,
  leaveUsages: LeaveUsage[],
) {
  return leaveUsages
    .filter((usage) => usage.leaveGrantId === leaveGrantId && !usage.canceled)
    .reduce((sum, usage) => sum + getLeaveUsageDays(usage), 0)
}

export function getAvailableDays(
  leaveGrant: LeaveGrant,
  leaveUsages: LeaveUsage[],
) {
  return leaveGrant.days - getUsedDaysForGrant(leaveGrant.id, leaveUsages)
}

export function doDateRangesOverlap(
  firstStart: CalendarDate,
  firstEnd: CalendarDate,
  secondStart: CalendarDate,
  secondEnd: CalendarDate,
) {
  return firstStart <= secondEnd && secondStart <= firstEnd
}

export function validateLeaveUsage(
  input: Pick<LeaveUsage, 'leaveGrantId' | 'startDate' | 'endDate'>,
  leaveGrants: LeaveGrant[],
  leaveUsages: LeaveUsage[],
  excludedUsageId?: string,
  outings: Outing[] = [],
): LeaveUsageValidation {
  const otherLeaveUsages = leaveUsages.filter(
    (leaveUsage) => leaveUsage.id !== excludedUsageId,
  )
  const leaveGrant = leaveGrants.find((grant) => grant.id === input.leaveGrantId)

  if (!leaveGrant) {
    return {
      valid: false,
      reason: 'leaveGrantNotFound',
      message: '사용할 보유 휴가를 선택해주세요.',
    }
  }

  const requestedDays = getInclusiveDayCount(input.startDate, input.endDate)
  const availableDays = getAvailableDays(leaveGrant, otherLeaveUsages)

  if (requestedDays > availableDays) {
    return {
      valid: false,
      reason: 'insufficientDays',
      message: `사용 가능한 휴가가 ${requestedDays - availableDays}일 부족합니다.`,
    }
  }

  const overlappingRanges = otherLeaveUsages
    .filter(
      (usage) =>
        !usage.canceled &&
        doDateRangesOverlap(
          input.startDate,
          input.endDate,
          usage.startDate,
          usage.endDate,
        ),
    )
    .map((usage) => ({
      startDate:
        usage.startDate < input.startDate ? input.startDate : usage.startDate,
      endDate: usage.endDate > input.endDate ? input.endDate : usage.endDate,
    }))
    .sort((first, second) => first.startDate.localeCompare(second.startDate))

  const mergedOverlappingRanges = overlappingRanges.reduce<
    { startDate: CalendarDate; endDate: CalendarDate }[]
  >((ranges, range) => {
    const previousRange = ranges.at(-1)

    if (
      previousRange &&
      range.startDate <= addCalendarDays(previousRange.endDate, 1)
    ) {
      if (range.endDate > previousRange.endDate) {
        previousRange.endDate = range.endDate
      }
      return ranges
    }

    ranges.push({ ...range })
    return ranges
  }, [])

  if (mergedOverlappingRanges.length > 0) {
    const overlappingPeriod = mergedOverlappingRanges
      .map(({ startDate, endDate }) => `${startDate} ~ ${endDate}`)
      .join(', ')

    return {
      valid: false,
      reason: 'overlap',
      message: `이미 등록된 ${overlappingPeriod} 일정과 겹칩니다.`,
    }
  }

  const overlappingOutingDates = outings
    .filter(
      (outing) =>
        !outing.canceled &&
        input.startDate <= outing.date &&
        outing.date <= input.endDate,
    )
    .map((outing) => outing.date)
    .sort()

  if (overlappingOutingDates.length > 0) {
    return {
      valid: false,
      reason: 'outingOverlap',
      message: `${overlappingOutingDates.join(', ')}에 외출이 등록되어 있어 휴가 일정을 저장할 수 없습니다.`,
    }
  }

  return { valid: true }
}
