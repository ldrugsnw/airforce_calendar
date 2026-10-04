import { isCalendarDate } from '../domain/calendarDate'
import {
  MAX_LEAVE_GRANT_DAYS,
  MAX_LEAVE_MEMO_LENGTH,
  MAX_LEAVE_REASON_LENGTH,
  isLeaveType,
} from '../domain/leave'
import type { AppState } from '../store/appReducer'

export type AccountSnapshot = {
  userId: string
  status: 'active' | 'pending_deletion'
  localMigrationCompletedAt: string | null
  localMigrationFingerprint: string | null
  onboardingCompletedAt?: string | null
  onboardingGrantIds?: { annual: string; performance: string } | null
}

export type AppSnapshot = AppState & {
  account: AccountSnapshot
  syncedAt: string
}

export type AppServerErrorCode =
  | 'AUTH_REQUIRED'
  | 'ACCOUNT_INACTIVE'
  | 'NOT_FOUND'
  | 'REVISION_CONFLICT'
  | 'DATE_OVERLAP'
  | 'OUTING_OVERLAP'
  | 'INSUFFICIENT_DAYS'
  | 'ACTIVE_USAGE_EXISTS'
  | 'LEAVE_GRANT_NOT_FOUND'
  | 'MIGRATION_ALREADY_COMPLETED'
  | 'MIGRATION_SERVER_NOT_EMPTY'
  | 'MIGRATION_INVALID_VERSION'
  | 'NETWORK_ERROR'
  | 'CONFIRMATION_REQUIRED'
  | 'UNKNOWN_ERROR'

export type MutationResult =
  | { ok: true; snapshot: AppSnapshot }
  | { ok: false; code: AppServerErrorCode; message: string }

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}

export function isAppSnapshot(value: unknown): value is AppSnapshot {
  if (!isRecord(value) || !isRecord(value.account)) return false

  const { account } = value
  return (
    typeof account.userId === 'string' &&
    (account.status === 'active' || account.status === 'pending_deletion') &&
    (account.localMigrationCompletedAt === null ||
      typeof account.localMigrationCompletedAt === 'string') &&
    (account.localMigrationFingerprint === null ||
      typeof account.localMigrationFingerprint === 'string') &&
    (account.onboardingCompletedAt === undefined || account.onboardingCompletedAt === null || typeof account.onboardingCompletedAt === 'string') &&
    (account.onboardingGrantIds === undefined || account.onboardingGrantIds === null ||
      (isRecord(account.onboardingGrantIds) && typeof account.onboardingGrantIds.annual === 'string' && typeof account.onboardingGrantIds.performance === 'string')) &&
    typeof value.syncedAt === 'string' &&
    Array.isArray(value.leaveGrants) &&
    value.leaveGrants.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        isLeaveType(item.type) &&
        typeof item.days === 'number' &&
        Number.isInteger(item.days) &&
        item.days >= 1 &&
        item.days <= MAX_LEAVE_GRANT_DAYS &&
        (item.acquiredDate === null || isCalendarDate(item.acquiredDate)) &&
        typeof item.reason === 'string' &&
        item.reason.length <= MAX_LEAVE_REASON_LENGTH &&
        typeof item.memo === 'string' &&
        item.memo.length <= MAX_LEAVE_MEMO_LENGTH &&
        Number.isInteger(item.revision),
    ) &&
    Array.isArray(value.leaveUsages) &&
    value.leaveUsages.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        typeof item.leaveGrantId === 'string' &&
        isCalendarDate(item.startDate) &&
        isCalendarDate(item.endDate) &&
        typeof item.canceled === 'boolean' &&
        Number.isInteger(item.revision),
    ) &&
    Array.isArray(value.outings) &&
    value.outings.every(
      (item) =>
        isRecord(item) &&
        typeof item.id === 'string' &&
        isCalendarDate(item.date) &&
        typeof item.reason === 'string' &&
        item.reason.length <= 100 &&
        typeof item.canceled === 'boolean' &&
        Number.isInteger(item.revision),
    )
  )
}

const ERROR_MESSAGES: Record<AppServerErrorCode, string> = {
  AUTH_REQUIRED: '로그인이 필요합니다.',
  ACCOUNT_INACTIVE: '현재 사용할 수 없는 계정입니다.',
  NOT_FOUND: '다른 기기에서 기록이 삭제되었습니다.',
  REVISION_CONFLICT: '다른 기기에서 변경되었습니다. 최신 내용을 다시 불러왔습니다.',
  DATE_OVERLAP: '선택한 기간이 다른 휴가 일정과 겹칩니다.',
  OUTING_OVERLAP: '선택한 날짜에 휴가 또는 외출 일정이 있습니다.',
  INSUFFICIENT_DAYS: '사용 가능한 휴가 일수를 초과했습니다.',
  ACTIVE_USAGE_EXISTS: '연결된 휴가 일정을 먼저 모두 취소해주세요.',
  LEAVE_GRANT_NOT_FOUND: '선택한 보유 휴가를 찾을 수 없습니다.',
  MIGRATION_ALREADY_COMPLETED: '이 계정은 이미 로컬 데이터 이전을 완료했습니다.',
  MIGRATION_SERVER_NOT_EMPTY: '서버에 데이터가 있어 자동으로 합칠 수 없습니다.',
  MIGRATION_INVALID_VERSION: '이전할 로컬 데이터 형식을 확인해주세요.',
  NETWORK_ERROR: '서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.',
  CONFIRMATION_REQUIRED: '기존 기록의 변경 범위를 확인하고 저장해주세요.',
  UNKNOWN_ERROR: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해주세요.',
}

export function toServerErrorCode(value: unknown): AppServerErrorCode {
  const code = typeof value === 'string' ? value : 'UNKNOWN_ERROR'
  return code in ERROR_MESSAGES
    ? (code as AppServerErrorCode)
    : 'UNKNOWN_ERROR'
}

export function getServerErrorMessage(code: AppServerErrorCode) {
  return ERROR_MESSAGES[code]
}
