import { useState } from 'react'
import type { CalendarMonth } from '../domain/calendarDate'

type CalendarMonthHeaderProps = {
  visibleMonth: CalendarMonth
  onPreviousMonth: () => void
  onNextMonth: () => void
  onMonthJump: (month: CalendarMonth) => void
  onToday: () => void
}

export function CalendarMonthHeader({
  visibleMonth,
  onPreviousMonth,
  onNextMonth,
  onMonthJump,
  onToday,
}: CalendarMonthHeaderProps) {
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState(visibleMonth.year)

  function toggleMonthPicker() {
    if (!isMonthPickerOpen) setSelectedYear(visibleMonth.year)
    setIsMonthPickerOpen((current) => !current)
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <button
          aria-label="이전 달"
          className="flex size-12 items-center justify-center rounded-2xl text-xl text-slate-600 transition hover:bg-slate-100 active:bg-slate-200"
          disabled={visibleMonth.year === 2000 && visibleMonth.month === 1}
          onClick={onPreviousMonth}
          type="button"
        >
          ←
        </button>
        <h2 className="text-lg font-bold text-slate-950">
          <button
            aria-expanded={isMonthPickerOpen}
            aria-label={`${visibleMonth.year}년 ${visibleMonth.month}월, 연도와 월 선택`}
            className="min-h-12 rounded-2xl px-4 transition hover:bg-slate-100 active:bg-slate-200"
            onClick={toggleMonthPicker}
            type="button"
          >
            <span aria-live="polite">{visibleMonth.year}년 {visibleMonth.month}월</span>
            <span aria-hidden="true" className="ml-1 text-sm text-slate-500">⌄</span>
          </button>
        </h2>
        <button
          aria-label="다음 달"
          className="flex size-12 items-center justify-center rounded-2xl text-xl text-slate-600 transition hover:bg-slate-100 active:bg-slate-200"
          disabled={visibleMonth.year === 2999 && visibleMonth.month === 12}
          onClick={onNextMonth}
          type="button"
        >
          →
        </button>
      </div>
      <div className="mt-1 flex justify-end">
        <button
          className="min-h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
          onClick={() => {
            onToday()
            setIsMonthPickerOpen(false)
          }}
          type="button"
        >
          오늘
        </button>
      </div>
      {isMonthPickerOpen && (
        <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <label className="text-sm font-semibold text-slate-800" htmlFor="calendar-jump-year">
            연도
          </label>
          <select
            className="mt-2 h-12 w-full appearance-none rounded-xl border border-slate-300 bg-white px-4 text-base font-semibold text-slate-900"
            id="calendar-jump-year"
            onChange={(event) => setSelectedYear(Number(event.target.value))}
            value={selectedYear}
          >
            {Array.from({ length: 1000 }, (_, index) => index + 2000).map((year) => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
          <div aria-label="이동할 월" className="mt-3 grid grid-cols-3 gap-2" role="group">
            {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
              <button
                aria-pressed={selectedYear === visibleMonth.year && month === visibleMonth.month}
                className={`min-h-11 rounded-xl border text-sm font-semibold transition ${
                  selectedYear === visibleMonth.year && month === visibleMonth.month
                    ? 'border-brand-600 bg-brand-50 text-brand-700'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                }`}
                key={month}
                onClick={() => {
                  onMonthJump({ year: selectedYear, month })
                  setIsMonthPickerOpen(false)
                }}
                type="button"
              >
                {month}월
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
