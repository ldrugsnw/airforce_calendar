import {
  CalendarDayButton,
  type CalendarDayItem,
} from './CalendarDayButton'
import type { CalendarDate } from '../domain/calendarDate'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

type CalendarGridProps = {
  days: Array<CalendarDayItem | null>
  disabled: boolean
  onSelectDate: (date: CalendarDate) => void
}

export function CalendarGrid({
  days,
  disabled,
  onSelectDate,
}: CalendarGridProps) {
  return (
    <>
      <div className="mt-3 grid grid-cols-7 text-center text-xs font-semibold text-slate-400">
        {WEEKDAYS.map((weekday, index) => (
          <div
            className={
              index === 0
                ? 'text-red-500'
                : index === 6
                  ? 'text-blue-500'
                  : ''
            }
            key={weekday}
          >
            {weekday}
          </div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-y-1">
        {days.map((day, index) =>
          day ? (
            <CalendarDayButton
              {...day}
              disabled={disabled}
              key={day.date}
              onSelect={onSelectDate}
            />
          ) : (
            <div
              aria-hidden="true"
              className="size-10"
              key={`empty-${index}`}
            />
          ),
        )}
      </div>
    </>
  )
}
