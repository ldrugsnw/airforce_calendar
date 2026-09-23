import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { getKstToday } from '../domain/calendarDate'
import {
  LEAVE_TYPES,
  getLeaveTypeLabel,
  type LeaveGrant,
  type LeaveType,
} from '../domain/leave'
import {
  getLeaveGrantSummary,
  type LeaveGrantSummary,
} from '../domain/leaveUsage'
import { useAppState } from '../store/appStateContext'

type LeaveSortOption =
  | 'recommended'
  | 'newest'
  | 'oldest'
  | 'name'
  | 'available'

type SummaryView = 'available' | 'completed' | 'total'
type LeaveTypeFilter = 'all' | LeaveType

type LeaveGrantWithSummary = {
  grant: LeaveGrant
  summary: LeaveGrantSummary
}

const SORT_OPTIONS: { label: string; value: LeaveSortOption }[] = [
  { value: 'recommended', label: '기본순' },
  { value: 'newest', label: '최근 획득순' },
  { value: 'oldest', label: '오래된 획득순' },
  { value: 'name', label: '이름순' },
  { value: 'available', label: '사용 가능 일수순' },
]

const SUMMARY_VIEW_CONTENT: Record<
  SummaryView,
  { description: string; label: string }
> = {
  available: {
    label: '사용 가능',
    description: '등록한 사용 일정을 제외하고 새로 계획할 수 있는 일수입니다.',
  },
  completed: {
    label: '사용 완료',
    description: '오늘 이전에 사용을 마친 휴가 일수입니다.',
  },
  total: {
    label: '총 휴가',
    description: '등록한 모든 보유 휴가의 최초 획득 일수 합계입니다.',
  },
}

const LEAVE_CARD_STYLES: Record<
  LeaveType,
  { active: string; activeBadge: string; completed: string; completedBadge: string }
> = {
  annual: {
    active: 'border-blue-300 bg-blue-50',
    activeBadge: 'bg-blue-600 text-white',
    completed: 'border-blue-100 bg-blue-50/40',
    completedBadge: 'bg-blue-100 text-blue-700',
  },
  reward: {
    active: 'border-red-300 bg-red-50',
    activeBadge: 'bg-red-600 text-white',
    completed: 'border-red-100 bg-red-50/40',
    completedBadge: 'bg-red-100 text-red-700',
  },
  consolation: {
    active: 'border-amber-300 bg-amber-50',
    activeBadge: 'calendar-consolation bg-amber-300',
    completed: 'border-amber-100 bg-amber-50/40',
    completedBadge: 'bg-amber-100 text-amber-700',
  },
  official: {
    active: 'border-violet-300 bg-violet-50',
    activeBadge: 'bg-violet-600 text-white',
    completed: 'border-violet-100 bg-violet-50/40',
    completedBadge: 'bg-violet-100 text-violet-700',
  },
  petition: {
    active: 'border-slate-500 bg-slate-100',
    activeBadge: 'bg-slate-950 text-white',
    completed: 'border-slate-200 bg-slate-50',
    completedBadge: 'bg-slate-200 text-slate-700',
  },
  performance: {
    active: 'border-green-300 bg-green-50',
    activeBadge: 'bg-green-600 text-white',
    completed: 'border-green-100 bg-green-50/40',
    completedBadge: 'bg-green-100 text-green-700',
  },
  other: {
    active: 'border-slate-300 bg-slate-50',
    activeBadge: 'bg-slate-600 text-white',
    completed: 'border-slate-200 bg-slate-50/60',
    completedBadge: 'bg-slate-200 text-slate-700',
  },
}

export function LeavePage() {
  const { leaveGrants, leaveUsages } = useAppState()
  const [sortOption, setSortOption] = useState<LeaveSortOption>('recommended')
  const [typeFilter, setTypeFilter] = useState<LeaveTypeFilter>('all')
  const [summaryView, setSummaryView] = useState<SummaryView>('available')
  const today = getKstToday()
  const grantsWithSummaries = useMemo(
    () =>
      leaveGrants.map((grant) => ({
        grant,
        summary: getLeaveGrantSummary(grant, leaveUsages, today),
      })),
    [leaveGrants, leaveUsages, today],
  )
  const sortedGrants = useMemo(
    () =>
      sortLeaveGrants(
        grantsWithSummaries.filter(
          ({ grant }) => typeFilter === 'all' || grant.type === typeFilter,
        ),
        sortOption,
      ),
    [grantsWithSummaries, sortOption, typeFilter],
  )
  const summaryTotals = grantsWithSummaries.reduce(
    (totals, item) => ({
      available: totals.available + item.summary.availableDays,
      completed: totals.completed + item.summary.completedDays,
      total: totals.total + item.grant.days,
    }),
    { available: 0, completed: 0, total: 0 },
  )
  const groups = createLeaveGrantGroups(sortedGrants, sortOption)
  const summaryContent = SUMMARY_VIEW_CONTENT[summaryView]

  return (
    <>
      <PageHeader
        description="획득한 휴가와 종류별 사용 가능 일수를 관리하세요."
        title="내 휴가"
      />

      <section
        aria-label="내 휴가 전체 요약"
        className="mt-8 rounded-3xl bg-slate-950 p-6 text-white shadow-sm"
      >
        <div className="grid grid-cols-3 rounded-2xl bg-white/10 p-1">
          {(Object.keys(SUMMARY_VIEW_CONTENT) as SummaryView[]).map((view) => (
            <button
              aria-pressed={summaryView === view}
              className={`min-h-11 rounded-xl px-2 text-xs font-semibold transition-colors ${
                summaryView === view
                  ? 'bg-white text-slate-950 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
              key={view}
              onClick={() => setSummaryView(view)}
              type="button"
            >
              {SUMMARY_VIEW_CONTENT[view].label}
            </button>
          ))}
        </div>
        <div aria-live="polite" className="mt-5">
          <p className="text-sm font-medium text-slate-300">
            {summaryContent.label}
          </p>
          <p className="mt-2 text-4xl font-bold tracking-tight">
            {summaryTotals[summaryView]}
            <span className="ml-1 text-lg font-semibold text-slate-300">일</span>
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            {summaryContent.description}
          </p>
        </div>
      </section>

      <div className="mt-6 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-slate-950">보유 휴가 목록</h2>
        <Link
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
          to="/leave/new"
        >
          휴가 추가
        </Link>
      </div>

      {leaveGrants.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectControl
            label="휴가 종류"
            onChange={(value) => setTypeFilter(value as LeaveTypeFilter)}
            options={[
              { value: 'all', label: '전체 휴가' },
              ...LEAVE_TYPES.map(({ label, value }) => ({ label, value })),
            ]}
            value={typeFilter}
          />
          <SelectControl
            label="목록 정렬"
            onChange={(value) => setSortOption(value as LeaveSortOption)}
            options={SORT_OPTIONS}
            value={sortOption}
          />
        </div>
      )}

      {leaveGrants.length === 0 ? (
        <EmptyState
          description="연가, 포상휴가, 위로휴가, 공가, 청원휴가, 성과제와 기타 휴가를 기록해보세요."
          eyebrow="비어 있음"
          title="등록된 보유 휴가가 없어요"
        />
      ) : sortedGrants.length === 0 ? (
        <EmptyState
          description="다른 휴가 종류를 선택하거나 새 보유 휴가를 추가해주세요."
          eyebrow="필터 결과 없음"
          title="선택한 종류의 휴가가 없어요"
        />
      ) : (
        <div className="mt-5 space-y-6">
          {groups.map((group) => (
            <section key={group.type ?? 'sorted-list'}>
              {group.type && (
                <h3 className="mb-3 text-sm font-bold text-slate-700">
                  {getLeaveTypeLabel(group.type)}
                </h3>
              )}
              <ul className="space-y-3">
                {group.items.map(({ grant, summary }) => (
                  <LeaveGrantCard
                    grant={grant}
                    key={grant.id}
                    summary={summary}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  )
}

function sortLeaveGrants(
  items: LeaveGrantWithSummary[],
  sortOption: LeaveSortOption,
) {
  const typeOrder = new Map(
    LEAVE_TYPES.map((type, index) => [type.value, index]),
  )
  const compareReason = (first: LeaveGrant, second: LeaveGrant) =>
    (first.reason || '사유 없음').localeCompare(
      second.reason || '사유 없음',
      'ko',
    )
  const compareStable = (
    first: LeaveGrantWithSummary,
    second: LeaveGrantWithSummary,
  ) => compareReason(first.grant, second.grant) || first.grant.id.localeCompare(second.grant.id)
  const compareAcquiredDate = (
    first: LeaveGrant,
    second: LeaveGrant,
    direction: 'ascending' | 'descending',
  ) => {
    if (first.acquiredDate === null) return second.acquiredDate === null ? 0 : 1
    if (second.acquiredDate === null) return -1
    return direction === 'ascending'
      ? first.acquiredDate.localeCompare(second.acquiredDate)
      : second.acquiredDate.localeCompare(first.acquiredDate)
  }

  return [...items].sort((first, second) => {
    if (sortOption === 'recommended') {
      return (
        (typeOrder.get(first.grant.type) ?? 0) -
          (typeOrder.get(second.grant.type) ?? 0) ||
        Number(second.summary.availableDays > 0) -
          Number(first.summary.availableDays > 0) ||
        compareAcquiredDate(first.grant, second.grant, 'ascending') ||
        compareStable(first, second)
      )
    }

    if (sortOption === 'newest') {
      return (
        compareAcquiredDate(first.grant, second.grant, 'descending') ||
        compareStable(first, second)
      )
    }

    if (sortOption === 'oldest') {
      return (
        compareAcquiredDate(first.grant, second.grant, 'ascending') ||
        compareStable(first, second)
      )
    }

    if (sortOption === 'name') {
      return (
        getLeaveTypeLabel(first.grant.type).localeCompare(
          getLeaveTypeLabel(second.grant.type),
          'ko',
        ) || compareStable(first, second)
      )
    }

    return (
      second.summary.availableDays - first.summary.availableDays ||
      compareStable(first, second)
    )
  })
}

function createLeaveGrantGroups(
  items: LeaveGrantWithSummary[],
  sortOption: LeaveSortOption,
) {
  if (sortOption !== 'recommended') {
    return [{ type: null, items }]
  }

  return LEAVE_TYPES.map(({ value }) => ({
    type: value,
    items: items.filter((item) => item.grant.type === value),
  })).filter((group) => group.items.length > 0)
}

type SelectControlProps = {
  label: string
  onChange: (value: string) => void
  options: { label: string; value: string }[]
  value: string
}

function SelectControl({
  label,
  onChange,
  options,
  value,
}: SelectControlProps) {
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      <div className="relative mt-2">
        <select
          className="h-14 w-full appearance-none rounded-2xl border border-slate-300 bg-white px-4 pr-12 text-base font-normal text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-500"
          fill="none"
          viewBox="0 0 20 20"
        >
          <path
            d="m6 8 4 4 4-4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.75"
          />
        </svg>
      </div>
    </label>
  )
}

type LeaveGrantCardProps = LeaveGrantWithSummary

function LeaveGrantCard({ grant, summary }: LeaveGrantCardProps) {
  const isCompleted = summary.completedDays === summary.totalDays
  const styles = LEAVE_CARD_STYLES[grant.type]

  return (
    <li>
      <Link
        aria-label={`${getLeaveTypeLabel(grant.type)} ${grant.days}일 상세 보기`}
        className={`block rounded-2xl border p-5 shadow-sm transition hover:shadow-md ${
          isCompleted ? styles.completed : styles.active
        }`}
        to={`/leave/${grant.id}`}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                  isCompleted ? styles.completedBadge : styles.activeBadge
                }`}
              >
                {getLeaveTypeLabel(grant.type)}
              </span>
              {isCompleted && (
                <span className="inline-flex rounded-full bg-white/80 px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  사용 완료
                </span>
              )}
            </div>
            <p className="mt-3 truncate text-sm font-semibold text-slate-900">
              {grant.reason || '사유 없음'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {grant.acquiredDate ? `${grant.acquiredDate} 획득` : '획득일 미입력'}
            </p>
          </div>
          <p
            aria-label={`${grant.days}일`}
            className="shrink-0 text-2xl font-bold text-slate-950"
          >
            {grant.days}
            <span className="ml-1 text-sm font-semibold text-slate-500">일</span>
          </p>
        </div>
        <dl className="mt-4 grid grid-cols-4 gap-2 border-t border-black/5 pt-4 text-center">
          <SummaryItem label="총 획득" value={summary.totalDays} />
          <SummaryItem label="사용 완료" value={summary.completedDays} />
          <SummaryItem label="사용 예정" value={summary.scheduledDays} />
          <SummaryItem
            emphasized
            label="사용 가능"
            value={summary.availableDays}
          />
        </dl>
        {grant.memo && (
          <p className="mt-4 border-t border-black/5 pt-4 text-sm leading-6 text-slate-600">
            {grant.memo}
          </p>
        )}
      </Link>
    </li>
  )
}

type SummaryItemProps = {
  emphasized?: boolean
  label: string
  value: number
}

function SummaryItem({ emphasized = false, label, value }: SummaryItemProps) {
  return (
    <div>
      <dt className="text-[0.6875rem] font-medium text-slate-500">{label}</dt>
      <dd
        className={`mt-1 text-sm font-bold ${
          emphasized ? 'text-brand-700' : 'text-slate-900'
        }`}
      >
        {value}일
      </dd>
    </div>
  )
}
