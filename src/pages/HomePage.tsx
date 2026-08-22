import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { PageHeader } from '../components/PageHeader'
import { formatCalendarDate, getKstToday } from '../domain/calendarDate'
import { getLeaveTypeLabel } from '../domain/leave'
import {
  createContinuousLeaveSchedules,
  getCurrentAndNextLeaveSchedules,
  getLeaveScheduleDday,
  type ContinuousLeaveSchedule,
} from '../domain/leaveUsage'
import { useAppState } from '../store/appStateContext'

export function HomePage() {
  const { leaveGrants, leaveUsages } = useAppState()
  const today = getKstToday()
  const schedules = createContinuousLeaveSchedules(leaveUsages, leaveGrants)
  const { currentSchedule, nextSchedule } = getCurrentAndNextLeaveSchedules(
    schedules,
    today,
  )
  const dday = nextSchedule ? getLeaveScheduleDday(nextSchedule, today) : null
  const hasCurrentOrNextSchedule = Boolean(currentSchedule || nextSchedule)

  return (
    <>
      <PageHeader
        description="다음 휴가와 사용할 수 있는 휴가를 빠르게 확인하세요."
        title="홈"
      />
      {hasCurrentOrNextSchedule ? (
        <div className="mt-8 space-y-5">
          {currentSchedule && (
            <HomeScheduleCard
              eyebrow={
                currentSchedule.startDate === today
                  ? '오늘 휴가 시작'
                  : '현재 휴가 중'
              }
              schedule={currentSchedule}
            />
          )}
          {nextSchedule && (
            <HomeScheduleCard
              eyebrow={`다음 휴가까지 D-${dday}`}
              schedule={nextSchedule}
            />
          )}
        </div>
      ) : (
        <>
          <EmptyState
            description="보유 휴가와 사용 일정을 등록하면 다음 휴가 D-day가 이곳에 표시됩니다."
            eyebrow="준비 완료"
            title="아직 예정된 휴가가 없어요"
          />
          <Link
            className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm"
            to="/calendar"
          >
            달력에서 휴가 계획하기
          </Link>
        </>
      )}
    </>
  )
}

type HomeScheduleCardProps = {
  eyebrow: string
  schedule: ContinuousLeaveSchedule
}

function HomeScheduleCard({ eyebrow, schedule }: HomeScheduleCardProps) {
  return (
    <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-sm">
      <p className="text-sm font-semibold text-blue-200">{eyebrow}</p>
      <h2
        aria-label={`${formatCalendarDate(schedule.startDate)} ~ ${formatCalendarDate(schedule.endDate)}`}
        className="mt-3 flex flex-wrap items-baseline gap-x-2 text-2xl font-bold tracking-tight"
      >
        <span className="whitespace-nowrap">
          {formatCalendarDate(schedule.startDate)}{' '}
        </span>
        <span className="whitespace-nowrap">
          ~ {formatCalendarDate(schedule.endDate)}
        </span>
      </h2>
      <p className="mt-2 text-sm text-slate-300">총 {schedule.totalDays}일</p>
      <p className="mt-4 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold leading-6">
        {schedule.composition
          .map(({ days, type }) => `${getLeaveTypeLabel(type)} ${days}일`)
          .join(' + ')}
      </p>
      <Link
        className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-white px-4 text-sm font-semibold text-slate-950"
        to="/calendar"
      >
        달력에서 일정 보기
      </Link>
    </section>
  )
}
