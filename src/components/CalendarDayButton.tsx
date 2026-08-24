import { formatCalendarDate, type CalendarDate } from '../domain/calendarDate'

type CalendarDayButtonProps = {
  date: CalendarDate
  day: number
  weekdayIndex: number
  isToday: boolean
  usageLabel: string
  hasOuting: boolean
  isSelected: boolean
  connectsPrevious: boolean
  connectsNext: boolean
  leaveClassName?: string
  disabled: boolean
  onSelect: (date: CalendarDate) => void
}

export function CalendarDayButton({
  date,
  day,
  weekdayIndex,
  isToday,
  usageLabel,
  hasOuting,
  isSelected,
  connectsPrevious,
  connectsNext,
  leaveClassName,
  disabled,
  onSelect,
}: CalendarDayButtonProps) {
  const dayClassName = isSelected
    ? 'bg-blue-100 text-blue-950'
    : leaveClassName
      ? leaveClassName
      : isToday
        ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-500'
        : weekdayIndex === 0
          ? 'text-red-500 hover:bg-red-50'
          : weekdayIndex === 6
            ? 'text-blue-500 hover:bg-blue-50'
            : 'text-slate-700 hover:bg-slate-100'

  return (
    <button
      aria-label={`${formatCalendarDate(date)}${isToday ? ', 오늘' : ''}${usageLabel ? `, ${usageLabel}` : ''}${hasOuting ? ', 외출' : ''}`}
      aria-pressed={isSelected}
      className={`relative mx-auto flex h-10 w-full items-center justify-center text-sm font-medium transition ${
        connectsPrevious ? 'rounded-l-none' : 'rounded-l-xl'
      } ${connectsNext ? 'rounded-r-none' : 'rounded-r-xl'} ${dayClassName}`}
      disabled={disabled}
      onClick={() => onSelect(date)}
      type="button"
    >
      <span>{day}</span>
      {hasOuting && (
        <span
          aria-hidden="true"
          className="absolute bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-orange-500 ring-1 ring-white"
        />
      )}
    </button>
  )
}
