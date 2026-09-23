export type CalendarDate = `${number}-${number}-${number}`

export type CalendarMonth = {
  year: number
  month: number
}

export type CalendarDay = {
  date: CalendarDate
  day: number
}

const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000
export const MIN_CALENDAR_DATE = '2000-01-01' as CalendarDate
export const MAX_CALENDAR_DATE = '2999-12-31' as CalendarDate

function toDateParts(date: CalendarDate) {
  const match = CALENDAR_DATE_PATTERN.exec(date)

  if (!match) {
    throw new Error(`올바르지 않은 달력 날짜입니다: ${date}`)
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const utcDate = new Date(Date.UTC(year, month - 1, day))

  if (
    utcDate.getUTCFullYear() !== year ||
    utcDate.getUTCMonth() !== month - 1 ||
    utcDate.getUTCDate() !== day
  ) {
    throw new Error(`존재하지 않는 달력 날짜입니다: ${date}`)
  }

  return { day, month, year }
}

export function isCalendarDate(value: unknown): value is CalendarDate {
  if (typeof value !== 'string') return false
  if (value < MIN_CALENDAR_DATE || value > MAX_CALENDAR_DATE) return false

  try {
    toDateParts(value as CalendarDate)
    return true
  } catch {
    return false
  }
}

export function addCalendarMonths(date: CalendarDate, months: number) {
  if (!Number.isInteger(months)) {
    throw new Error('이동할 개월 수는 정수여야 합니다.')
  }

  const { day, month, year } = toDateParts(date)
  const targetFirstDay = new Date(Date.UTC(year, month - 1 + months, 1))
  const targetYear = targetFirstDay.getUTCFullYear()
  const targetMonth = targetFirstDay.getUTCMonth() + 1
  const lastDay = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  const result = createCalendarDate(targetYear, targetMonth, Math.min(day, lastDay))

  if (!isCalendarDate(result)) {
    throw new Error(`허용된 날짜 범위를 벗어났습니다: ${result}`)
  }
  return result
}

function createCalendarDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as CalendarDate
}

function toDayNumber(date: CalendarDate) {
  const { day, month, year } = toDateParts(date)
  return Date.UTC(year, month - 1, day) / MILLISECONDS_PER_DAY
}

export function addCalendarDays(date: CalendarDate, days: number) {
  if (!Number.isInteger(days)) {
    throw new Error('이동할 날짜 수는 정수여야 합니다.')
  }

  const moved = new Date((toDayNumber(date) + days) * MILLISECONDS_PER_DAY)
  return createCalendarDate(
    moved.getUTCFullYear(),
    moved.getUTCMonth() + 1,
    moved.getUTCDate(),
  )
}

export function getCalendarDayDifference(
  startDate: CalendarDate,
  endDate: CalendarDate,
) {
  return toDayNumber(endDate) - toDayNumber(startDate)
}

export function getKstToday(now = new Date()): CalendarDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Seoul',
    year: 'numeric',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))

  return createCalendarDate(
    Number(values.year),
    Number(values.month),
    Number(values.day),
  )
}

export function getCalendarMonth(date: CalendarDate): CalendarMonth {
  const { month, year } = toDateParts(date)
  return { month, year }
}

export function moveCalendarMonth(
  { month, year }: CalendarMonth,
  offset: number,
): CalendarMonth {
  const moved = new Date(Date.UTC(year, month - 1 + offset, 1))
  return { month: moved.getUTCMonth() + 1, year: moved.getUTCFullYear() }
}

export function createMonthGrid({ month, year }: CalendarMonth) {
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error('올바르지 않은 연월입니다.')
  }

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: Array<CalendarDay | null> = Array.from({ length: 42 }, () => null)

  for (let day = 1; day <= lastDay; day += 1) {
    cells[firstWeekday + day - 1] = {
      date: createCalendarDate(year, month, day),
      day,
    }
  }

  return cells
}

export function orderCalendarRange(first: CalendarDate, second: CalendarDate) {
  return toDayNumber(first) <= toDayNumber(second)
    ? { endDate: second, startDate: first }
    : { endDate: first, startDate: second }
}

export function getInclusiveDayCount(startDate: CalendarDate, endDate: CalendarDate) {
  const difference = toDayNumber(endDate) - toDayNumber(startDate)

  if (difference < 0) {
    throw new Error('종료일은 시작일보다 빠를 수 없습니다.')
  }

  return difference + 1
}

export function formatCalendarDate(date: CalendarDate) {
  const { day, month, year } = toDateParts(date)
  return `${year}년 ${month}월 ${day}일`
}
