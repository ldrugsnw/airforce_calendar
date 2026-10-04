import { getLeaveTypeLabel, needsLeaveCorrection, type LeaveGrant, type LeaveType } from './leave'
import { isCalendarDate } from './calendarDate'
import { getUsedDaysForGrant } from './leaveUsage'
import type { AppState } from '../store/appReducer'
import type { OnboardingPlan } from '../server/appRepository'

export type ReviewItem = {
  key: string
  grantId?: string
  type: LeaveType
  label: string
  included: boolean
  days: string
  touched: boolean
  correction?: boolean
  acquiredDate?: string
  dateRequired?: boolean
}

export function createReviewItems(grants: LeaveGrant[], clear = false): ReviewItem[] {
  const hasOther = grants.some((grant) => grant.type !== 'annual' && grant.type !== 'performance')
  const correctionFields = (grant: LeaveGrant) => needsLeaveCorrection(grant) ? {
    correction: true, acquiredDate: isCalendarDate(grant.acquiredDate) ? grant.acquiredDate : '',
    dateRequired: grant.acquiredDate !== null && !isCalendarDate(grant.acquiredDate),
  } : {}
  const items = (['annual', 'performance'] as const).flatMap<ReviewItem>((type) => {
    const existing = grants.filter((grant) => grant.type === type)
    const label = getLeaveTypeLabel(type)
    if (existing.length === 0) return [{ key: type, type, label,
      included: type === 'annual' && (clear || !hasOther), days: '', touched: false }]
    return existing.map((grant, index) => ({
      key: `grant-${grant.id}`, grantId: grant.id, type,
      label: existing.length === 1 ? label : `${label} ${index + 1}`, ...correctionFields(grant),
      included: true, days: clear ? '' : String(grant.days), touched: false,
    }))
  })
  return [...items, ...grants.filter((g) => g.type !== 'annual' && g.type !== 'performance' && needsLeaveCorrection(g)).map((g) => ({
    key: `grant-${g.id}`, grantId: g.id, type: g.type, label: grants.filter((x) => x.type === g.type).length > 1 ? `${getLeaveTypeLabel(g.type)} ${grants.filter((x) => x.type === g.type).findIndex((x) => x.id === g.id) + 1}` : getLeaveTypeLabel(g.type),
    included: true, days: clear ? '' : String(g.days), touched: false, ...correctionFields(g),
  }))]
}

export function createOnboardingPlan(items: ReviewItem[], state: AppState, ids: Record<string, string> | null | undefined): OnboardingPlan {
  return { items: items.map((item) => ({ key: item.key, id: item.grantId ?? ids?.[item.key] ?? null,
    type: item.type, days: item.included ? Number(item.days) : null,
    ...(item.correction ? { acquiredDate: item.acquiredDate || null } : {}) })), expectedState: state, confirmed: false }
}

export function getOnboardingChanges(plan: OnboardingPlan) {
  return plan.items.flatMap((item) => {
    const old = plan.expectedState.leaveGrants.find((grant) => grant.id === item.id)
    if (!old && item.days === null) return []
    if (old?.days === item.days && (item.acquiredDate === undefined || item.acquiredDate === old.acquiredDate)) return []
    const usages = plan.expectedState.leaveUsages.filter((usage) => usage.leaveGrantId === item.id)
    return [{ ...item, old, activeCount: usages.filter((usage) => !usage.canceled).length,
      canceledCount: usages.filter((usage) => usage.canceled).length }]
  })
}

export function validateOnboardingChanges(plan: OnboardingPlan): string | null {
  for (const change of getOnboardingChanges(plan)) {
    if (!change.old) continue
    if (needsLeaveCorrection(change.old) && change.days === null) return '기존 범위 밖 기록은 삭제하지 않고 올바른 값으로 수정해주세요.'
    const label = getLeaveTypeLabel(change.type)
    if (change.days === null && change.activeCount > 0) return `${label}에 사용·예정 일정 ${change.activeCount}건이 있어 삭제할 수 없습니다. 등록 선택을 유지해주세요.`
    const usedDays = getUsedDaysForGrant(change.old.id, plan.expectedState.leaveUsages)
    if (change.days !== null && change.days < usedDays) return `${label}의 일수는 사용·예정 ${usedDays}일 이상이어야 합니다.`
  }
  return null
}
