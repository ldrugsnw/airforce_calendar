import type { CalendarMonth } from '../domain/calendarDate'

type CalendarMonthHeaderProps = {
  visibleMonth: CalendarMonth
  onPreviousMonth: () => void
  onNextMonth: () => void
}

export function CalendarMonthHeader({
  visibleMonth,
  onPreviousMonth,
  onNextMonth,
}: CalendarMonthHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        aria-label="이전 달"
        className="flex size-12 items-center justify-center rounded-2xl text-xl text-slate-600 transition hover:bg-slate-100 active:bg-slate-200"
        onClick={onPreviousMonth}
        type="button"
      >
        ←
      </button>
      <h2 className="text-lg font-bold text-slate-950" aria-live="polite">
        {visibleMonth.year}년 {visibleMonth.month}월
      </h2>
      <button
        aria-label="다음 달"
        className="flex size-12 items-center justify-center rounded-2xl text-xl text-slate-600 transition hover:bg-slate-100 active:bg-slate-200"
        onClick={onNextMonth}
        type="button"
      >
        →
      </button>
    </div>
  )
}
