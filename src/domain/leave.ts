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

export type LeaveGrant = {
  id: string
  type: LeaveType
  days: number
  acquiredDate: string
  reason: string
  memo: string
  createdAt: string
  updatedAt: string
  revision?: number
}

export function getLeaveTypeLabel(type: LeaveType) {
  return LEAVE_TYPES.find((leaveType) => leaveType.value === type)?.label ?? '기타'
}

export function isLeaveType(value: unknown): value is LeaveType {
  return LEAVE_TYPES.some((leaveType) => leaveType.value === value)
}
