import { isCalendarDate, type CalendarDate } from './calendarDate'
import type { LeaveUsage } from './leaveUsage'

export type Outing = {
  id: string
  date: CalendarDate
  reason: string
  canceled: boolean
  canceledAt: string | null
  createdAt: string
  updatedAt: string
  revision?: number
}

export type OutingValidation =
  | { valid: true }
  | {
      valid: false
      reason: 'invalidDate' | 'reasonRequired' | 'duplicate' | 'leaveOverlap'
      message: string
    }

export function validateOuting(
  input: Pick<Outing, 'date' | 'reason'>,
  outings: Outing[],
  leaveUsages: LeaveUsage[],
  excludedOutingId?: string,
): OutingValidation {
  if (!isCalendarDate(input.date)) {
    return {
      valid: false,
      reason: 'invalidDate',
      message: '외출 날짜를 선택해주세요.',
    }
  }

  if (!input.reason.trim()) {
    return {
      valid: false,
      reason: 'reasonRequired',
      message: '외출 사유를 입력해주세요.',
    }
  }

  const hasOutingOnSameDate = outings.some(
    (outing) =>
      outing.id !== excludedOutingId &&
      !outing.canceled &&
      outing.date === input.date,
  )

  if (hasOutingOnSameDate) {
    return {
      valid: false,
      reason: 'duplicate',
      message: `${input.date}에 이미 외출이 등록되어 있습니다.`,
    }
  }

  const hasLeaveOnSameDate = leaveUsages.some(
    (usage) =>
      !usage.canceled &&
      usage.startDate <= input.date &&
      input.date <= usage.endDate,
  )

  if (hasLeaveOnSameDate) {
    return {
      valid: false,
      reason: 'leaveOverlap',
      message: `${input.date}에 휴가가 등록되어 있어 외출을 저장할 수 없습니다.`,
    }
  }

  return { valid: true }
}
