import { isCalendarDate, type CalendarDate } from './calendarDate'

export const LEAVE_TYPES = [
  { value: 'annual', label: '연가' },
  { value: 'reward', label: '포상휴가' },
  { value: 'consolation', label: '위로휴가' },
  { value: 'official', label: '공가' },
  { value: 'petition', label: '청원휴가' },
  { value: 'performance', label: '성과제' },
  { value: 'other', label: '기타' },
] as const

export type LeaveType = (typeof LEAVE_TYPES)[number]['value']

export const MIN_LEAVE_GRANT_DAYS = 1
export const MAX_LEAVE_GRANT_DAYS = 365
export const MAX_LEAVE_REASON_LENGTH = 100
export const MAX_LEAVE_MEMO_LENGTH = 1000

export type LeaveGrant = {
  id: string
  type: LeaveType
  days: number
  acquiredDate: CalendarDate | null
  reason: string
  memo: string
  createdAt: string
  updatedAt: string
  revision?: number
}

export type LeaveGrantInput = Pick<
  LeaveGrant,
  'type' | 'days' | 'acquiredDate' | 'reason' | 'memo'
>

export function validateLeaveGrantInput(input: LeaveGrantInput) {
  if (!isLeaveType(input.type)) return '휴가 종류를 선택해주세요.'
  if (
    !Number.isInteger(input.days) ||
    input.days < MIN_LEAVE_GRANT_DAYS ||
    input.days > MAX_LEAVE_GRANT_DAYS
  ) {
    return `획득 일수는 ${MIN_LEAVE_GRANT_DAYS}~${MAX_LEAVE_GRANT_DAYS}일 정수로 입력해주세요.`
  }
  if (input.acquiredDate !== null && !isCalendarDate(input.acquiredDate)) {
    return '획득 날짜는 2000년부터 2999년 사이로 입력해주세요.'
  }
  if (input.reason.length > MAX_LEAVE_REASON_LENGTH) {
    return `획득 사유는 ${MAX_LEAVE_REASON_LENGTH}자 이하로 입력해주세요.`
  }
  if (input.memo.length > MAX_LEAVE_MEMO_LENGTH) {
    return `메모는 ${MAX_LEAVE_MEMO_LENGTH}자 이하로 입력해주세요.`
  }
  return null
}

export function getLeaveTypeLabel(type: LeaveType) {
  return LEAVE_TYPES.find((leaveType) => leaveType.value === type)?.label ?? '기타'
}

export function isLeaveType(value: unknown): value is LeaveType {
  return LEAVE_TYPES.some((leaveType) => leaveType.value === value)
}
