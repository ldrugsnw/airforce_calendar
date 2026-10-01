import {
  addCalendarDays,
  addCalendarMonths,
  createMonthGrid,
  getInclusiveDayCount,
  getKstToday,
  isCalendarDate,
  moveCalendarMonth,
  orderCalendarRange,
} from './calendarDate'

describe('달력 날짜 계산', () => {
  it('월말과 연말을 넘어 다음 날짜를 계산한다', () => {
    expect(addCalendarDays('2026-08-31', 1)).toBe('2026-09-01')
    expect(addCalendarDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addCalendarDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('월 이동에서 대상 월의 마지막 날로 보정한다', () => {
    expect(addCalendarMonths('2026-08-31', -6)).toBe('2026-02-28')
    expect(addCalendarMonths('2028-08-31', -6)).toBe('2028-02-29')
    expect(addCalendarMonths('2026-09-10', 6)).toBe('2027-03-10')
  })

  it('2000년부터 2999년까지만 앱 날짜로 허용한다', () => {
    expect(isCalendarDate('2000-01-01')).toBe(true)
    expect(isCalendarDate('2999-12-31')).toBe(true)
    expect(isCalendarDate('1999-12-31')).toBe(false)
    expect(isCalendarDate('3000-01-01')).toBe(false)
  })
  it('실행 환경과 관계없이 KST의 오늘 날짜를 구한다', () => {
    expect(getKstToday(new Date('2026-08-03T14:59:59Z'))).toBe('2026-08-03')
    expect(getKstToday(new Date('2026-08-03T15:00:00Z'))).toBe('2026-08-04')
  })

  it('시작일과 종료일 및 주말을 모두 포함해 일수를 센다', () => {
    expect(getInclusiveDayCount('2026-08-08', '2026-08-10')).toBe(3)
    expect(getInclusiveDayCount('2026-08-08', '2026-08-08')).toBe(1)
  })

  it('월말, 연말과 윤년을 날짜 차이에 포함한다', () => {
    expect(getInclusiveDayCount('2026-01-31', '2026-02-02')).toBe(3)
    expect(getInclusiveDayCount('2026-12-31', '2027-01-01')).toBe(2)
    expect(getInclusiveDayCount('2028-02-28', '2028-03-01')).toBe(3)
  })

  it('형식이 다르거나 존재하지 않는 달력 날짜를 거부한다', () => {
    expect(() => getInclusiveDayCount('2026-2-03', '2026-02-04')).toThrow(
      '올바르지 않은 달력 날짜',
    )
    expect(() => getInclusiveDayCount('2026-02-30', '2026-03-01')).toThrow(
      '존재하지 않는 달력 날짜',
    )
  })

  it('나중에 고른 날짜가 앞서도 시작일과 종료일을 정렬한다', () => {
    expect(orderCalendarRange('2026-08-10', '2026-08-08')).toEqual({
      endDate: '2026-08-10',
      startDate: '2026-08-08',
    })
  })

  it('월의 첫 요일과 마지막 날짜에 맞춰 6주 격자를 만든다', () => {
    const august = createMonthGrid({ month: 8, year: 2026 })
    const february = createMonthGrid({ month: 2, year: 2028 })

    expect(august).toHaveLength(42)
    expect(august[6]).toEqual({ date: '2026-08-01', day: 1 })
    expect(august[36]).toEqual({ date: '2026-08-31', day: 31 })
    expect(february.filter(Boolean)).toHaveLength(29)
  })

  it('월말과 연말을 넘어 표시 월을 이동한다', () => {
    expect(moveCalendarMonth({ month: 12, year: 2026 }, 1)).toEqual({
      month: 1,
      year: 2027,
    })
    expect(moveCalendarMonth({ month: 1, year: 2026 }, -1)).toEqual({
      month: 12,
      year: 2025,
    })
  })
})
