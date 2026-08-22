import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from '../app/App'
import type { LeaveGrant } from '../domain/leave'
import type { LeaveUsage } from '../domain/leaveUsage'
import { APP_STORAGE_KEY, saveAppState } from '../store/appStorage'

describe('월간 달력', () => {
  it('월을 이동하고 두 날짜를 이른 순서로 선택해 포함 일수를 보여준다', () => {
    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <App />
      </MemoryRouter>,
    )

    const calendarDescription = screen.getByText(/빈 날짜 한 번은 외출/)
    expect(calendarDescription).toHaveClass('whitespace-pre-line')
    expect(calendarDescription).toHaveTextContent(
      '빈 날짜 한 번은 외출, 두 번은 휴가 기간을 선택해요. 등록한 일정은 색상과 표시로 구분됩니다.',
    )

    const currentMonth = screen.getByRole('heading', { level: 2 }).textContent
    fireEvent.click(screen.getByRole('button', { name: '다음 달' }))
    expect(screen.getByRole('heading', { level: 2 })).not.toHaveTextContent(currentMonth ?? '')

    const dateButtons = screen
      .getAllByRole('button')
      .filter((button) => /^\d{4}년 \d{1,2}월 \d{1,2}일/.test(button.getAttribute('aria-label') ?? ''))
    const eighth = dateButtons.find((button) => button.textContent === '8')
    const tenth = dateButtons.find((button) => button.textContent === '10')

    if (!eighth || !tenth) throw new Error('테스트할 날짜 버튼을 찾지 못했습니다.')

    fireEvent.click(tenth)
    fireEvent.click(eighth)

    expect(screen.getByText(/주말과 공휴일을 포함해 총/)).toHaveTextContent('총 3일이에요.')
    expect(eighth).toHaveAttribute('aria-pressed', 'true')
    expect(tenth).toHaveAttribute('aria-pressed', 'true')
    expect(eighth).toHaveClass('bg-blue-100', 'rounded-r-none')
    expect(tenth).toHaveClass('bg-blue-100', 'rounded-l-none')
    expect(eighth).not.toHaveClass('ring-2', 'ring-offset-1')
  })

  it('빈 날짜를 한 번 눌러 외출 사유를 저장하고 주황색 점으로 표시한다', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T15:00:00.000Z'))

    render(<MemoryRouter initialEntries={['/calendar']}><App /></MemoryRouter>)

    const outingDate = screen.getByRole('button', { name: '2026년 8월 12일' })
    fireEvent.click(outingDate)

    expect(
      screen.getByRole('button', { name: '8월 12일 외출 등록' }),
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '8월 12일 외출 등록' }))
    fireEvent.change(screen.getByLabelText('외출 사유'), {
      target: { value: '개인 용무' },
    })
    fireEvent.click(screen.getByRole('button', { name: '외출 저장' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      '외출 일정이 저장되었습니다.',
    )
    expect(outingDate).toHaveAccessibleName(/외출/)
    expect(outingDate.querySelector('.bg-orange-500')).toBeInTheDocument()
    expect(screen.getByText('외출')).toBeInTheDocument()

    fireEvent.click(outingDate)
    expect(screen.getByText('등록된 외출 일정')).toBeInTheDocument()
    expect(screen.getByText('개인 용무')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '외출 수정' }))
    expect(screen.getByLabelText('외출 날짜')).toHaveValue('2026-08-12')
    expect(screen.getByLabelText('외출 사유')).toHaveValue('개인 용무')
    fireEvent.change(screen.getByLabelText('외출 날짜'), {
      target: { value: '2026-08-13' },
    })
    fireEvent.change(screen.getByLabelText('외출 사유'), {
      target: { value: '병원 진료' },
    })
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      '외출 일정이 수정되었습니다.',
    )
    expect(screen.getByText('병원 진료')).toBeInTheDocument()
    expect(outingDate).not.toHaveAccessibleName(/외출/)
    const updatedOutingDate = screen.getByRole('button', {
      name: /2026년 8월 13일, 외출/,
    })

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: '외출 취소' }))

    expect(screen.getByRole('status')).toHaveTextContent(
      '외출 일정이 취소되었습니다.',
    )
    expect(updatedOutingDate).not.toHaveAccessibleName(/외출/)

    vi.useRealTimers()

    await waitFor(() => {
      const storedData = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? '{}')
      expect(storedData.outings[0]).toMatchObject({
        date: '2026-08-13',
        reason: '병원 진료',
        canceled: true,
      })
    })

  })

  it('선택한 기간과 보유 휴가를 저장하고 달력에 종류를 표시한다', async () => {
    const leaveGrant: LeaveGrant = {
      id: 'leave-grant-1',
      type: 'annual',
      days: 10,
      acquiredDate: '2026-08-01',
      reason: '정기 연가',
      memo: '',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    saveAppState({ leaveGrants: [leaveGrant], leaveUsages: [], outings: [] })

    render(
      <MemoryRouter initialEntries={['/calendar']}>
        <App />
      </MemoryRouter>,
    )

    const dateButtons = screen
      .getAllByRole('button')
      .filter((button) => /^\d{4}년 \d{1,2}월 \d{1,2}일/.test(button.getAttribute('aria-label') ?? ''))
    const eighth = dateButtons.find((button) => button.textContent === '8')
    const tenth = dateButtons.find((button) => button.textContent === '10')

    if (!eighth || !tenth) throw new Error('테스트할 날짜 버튼을 찾지 못했습니다.')

    fireEvent.click(eighth)
    fireEvent.click(tenth)
    expect(screen.getByLabelText('사용할 보유 휴가')).toHaveClass(
      'h-14',
      'appearance-none',
    )
    fireEvent.change(screen.getByLabelText('사용할 보유 휴가'), {
      target: { value: leaveGrant.id },
    })
    fireEvent.click(screen.getByRole('button', { name: '휴가 일정 저장' }))

    expect(screen.getByRole('status')).toHaveTextContent('휴가 사용 일정이 저장되었습니다.')
    expect(eighth).toHaveAccessibleName(/연가/)

    fireEvent.click(eighth)

    expect(screen.getByText('등록된 휴가 일정')).toBeInTheDocument()
    expect(screen.getByText('획득 기록')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '일정 수정' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '일정 취소' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '상세 닫기' })).toBeInTheDocument()
    expect(screen.queryByLabelText('사용할 보유 휴가')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('heading', { name: '달력', level: 1 }))
    expect(screen.queryByText('등록된 휴가 일정')).not.toBeInTheDocument()
    expect(screen.getByText(/빈 날짜를 눌러 시작일과 종료일/)).toBeInTheDocument()

    fireEvent.click(eighth)

    fireEvent.click(screen.getByRole('button', { name: '일정 수정' }))
    expect(screen.getByLabelText('사용할 보유 휴가')).toHaveValue(leaveGrant.id)
    expect(eighth).toBeDisabled()

    const startInput = screen.getByLabelText('시작일')
    let endInput = screen.getByLabelText('종료일')
    expect(startInput).toHaveClass(
      'h-14',
      'min-w-0',
      'max-w-full',
      'calendar-date-input',
      'calendar-date-input-centered',
    )
    expect(endInput).toHaveClass(
      'h-14',
      'min-w-0',
      'max-w-full',
      'calendar-date-input',
      'calendar-date-input-centered',
    )
    expect(screen.getByLabelText('사용할 보유 휴가')).toHaveClass(
      'h-14',
      'appearance-none',
    )
    const yearMonth = (startInput as HTMLInputElement).value.slice(0, 8)

    fireEvent.change(endInput, { target: { value: `${yearMonth}11` } })
    fireEvent.click(screen.getByRole('button', { name: '수정 취소' }))
    expect(screen.getByText('등록된 휴가 일정')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '일정 수정' }))
    endInput = screen.getByLabelText('종료일')
    expect(endInput).toHaveValue(`${yearMonth}10`)

    fireEvent.change(endInput, { target: { value: `${yearMonth}07` } })
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      '종료일은 시작일보다 빠를 수 없습니다.',
    )

    fireEvent.change(endInput, { target: { value: `${yearMonth}12` } })
    expect(screen.getByText('변경할 휴가 일수').parentElement).toHaveTextContent('5일')
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }))
    expect(screen.getByRole('status')).toHaveTextContent('휴가 사용 일정이 수정되었습니다.')

    fireEvent.click(eighth)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: '일정 취소' }))

    expect(screen.getByRole('status')).toHaveTextContent('휴가 사용 일정이 취소되었습니다.')
    expect(eighth).not.toHaveAccessibleName(/연가/)

    await waitFor(() => {
      const storedData = JSON.parse(localStorage.getItem(APP_STORAGE_KEY) ?? '{}')
      expect(storedData.leaveUsages).toHaveLength(1)
      expect(storedData.leaveUsages[0]).toMatchObject({
        leaveGrantId: leaveGrant.id,
        endDate: `${yearMonth}12`,
        canceled: true,
      })
    })
  })

  it('종류별 색상을 유지하면서 인접한 기록의 경계를 연결한다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T15:00:00.000Z'))
    const leaveGrants: LeaveGrant[] = [
      {
        id: 'annual', type: 'annual', days: 3, acquiredDate: '2026-08-01', reason: '정기 연가', memo: '',
        createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      },
      {
        id: 'consolation', type: 'consolation', days: 2, acquiredDate: '2026-08-01', reason: '근무 위로', memo: '',
        createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]
    const baseUsage: LeaveUsage = {
      id: 'annual-usage', leaveGrantId: 'annual', startDate: '2026-08-08', endDate: '2026-08-10',
      canceled: false, canceledAt: null, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
    }
    saveAppState({
      leaveGrants,
      leaveUsages: [
        baseUsage,
        { ...baseUsage, id: 'consolation-usage', leaveGrantId: 'consolation', startDate: '2026-08-11', endDate: '2026-08-12' },
      ],
      outings: [],
    })

    render(<MemoryRouter initialEntries={['/calendar']}><App /></MemoryRouter>)

    const annualEnd = screen.getByRole('button', { name: /2026년 8월 10일, 연가/ })
    const consolationStart = screen.getByRole('button', { name: /2026년 8월 11일, 위로휴가/ })
    expect(annualEnd).toHaveClass('bg-blue-600', 'rounded-r-none')
    expect(consolationStart).toHaveClass('bg-amber-300', 'rounded-l-none')

    fireEvent.click(annualEnd)
    expect(screen.getByText('연결된 전체 일정')).toBeInTheDocument()
    expect(screen.getByText('총 5일 · 연가 3일 + 위로휴가 2일')).toBeInTheDocument()
    expect(screen.getByText(/\(선택한 기록\)/)).toBeInTheDocument()
    expect(screen.queryByText('선택한 개별 기록')).not.toBeInTheDocument()

    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: '일정 취소' }))
    fireEvent.click(consolationStart)

    expect(screen.getByText('총 2일 · 위로휴가 2일')).toBeInTheDocument()
    expect(screen.queryByText('총 5일 · 연가 3일 + 위로휴가 2일')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '홈' }))
    expect(screen.getByText('다음 휴가까지 D-5')).toBeInTheDocument()
    expect(screen.getByText('총 2일')).toBeInTheDocument()

    vi.useRealTimers()
  })

  it('표시 월에 겹치는 사용 기록만 범례에 표시하고 확정된 종류별 색상을 적용한다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-05T15:00:00.000Z'))
    const leaveGrants: LeaveGrant[] = [
      ['annual', 'annual', '정기 연가'],
      ['reward', 'reward', '우수 포상'],
      ['consolation', 'consolation', '근무 위로'],
      ['official', 'official', '공무 수행'],
      ['petition', 'petition', '가족 행사'],
      ['performance', 'performance', '성과 보상'],
      ['other', 'other', '기타 사유'],
    ].map(([id, type, reason]) => ({
      id,
      type: type as LeaveGrant['type'],
      days: 3,
      acquiredDate: '2026-08-01',
      reason,
      memo: '',
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }))
    const baseUsage: LeaveUsage = {
      id: 'annual-usage',
      leaveGrantId: 'annual',
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      canceled: false,
      canceledAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    saveAppState({
      leaveGrants,
      leaveUsages: [
        baseUsage,
        { ...baseUsage, id: 'reward-usage', leaveGrantId: 'reward', startDate: '2026-08-02', endDate: '2026-08-02' },
        { ...baseUsage, id: 'consolation-usage', leaveGrantId: 'consolation', startDate: '2026-08-03', endDate: '2026-08-03' },
        { ...baseUsage, id: 'petition-usage', leaveGrantId: 'petition', startDate: '2026-08-04', endDate: '2026-08-04' },
        { ...baseUsage, id: 'official-usage', leaveGrantId: 'official', startDate: '2026-08-05', endDate: '2026-08-05' },
        { ...baseUsage, id: 'performance-usage', leaveGrantId: 'performance', startDate: '2026-09-01', endDate: '2026-09-01' },
        { ...baseUsage, id: 'other-usage', leaveGrantId: 'other', startDate: '2026-08-31', endDate: '2026-09-02' },
        { ...baseUsage, id: 'canceled-annual-usage', startDate: '2026-09-03', endDate: '2026-09-03', canceled: true },
      ],
      outings: [],
    })

    render(<MemoryRouter initialEntries={['/calendar']}><App /></MemoryRouter>)

    expect(screen.getByRole('button', { name: /2026년 8월 1일, 연가/ })).toHaveClass('bg-blue-600')
    expect(screen.getByRole('button', { name: /2026년 8월 2일, 포상휴가/ })).toHaveClass('bg-red-600')
    expect(screen.getByRole('button', { name: /2026년 8월 3일, 위로휴가/ })).toHaveClass('bg-amber-300')
    expect(screen.getByRole('button', { name: /2026년 8월 4일, 청원휴가/ })).toHaveClass('bg-slate-950')
    expect(screen.getByRole('button', { name: /2026년 8월 5일, 공가/ })).toHaveClass('bg-violet-600')
    expect(screen.getByRole('button', { name: /2026년 8월 31일, 기타/ })).toHaveClass('bg-slate-600')
    const annualLegendText = screen.getByText('연가 · 정기 연가')
    expect(annualLegendText).toHaveClass('min-w-0', 'break-words')
    expect(annualLegendText.previousElementSibling).toHaveClass('shrink-0')
    expect(screen.getByText('기타 · 기타 사유')).toBeInTheDocument()
    expect(screen.queryByText('성과제 · 성과 보상')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '다음 달' }))

    expect(screen.getByRole('button', { name: /2026년 9월 1일, 성과제/ })).toHaveClass('bg-green-600')
    expect(screen.getByText('성과제 · 성과 보상')).toBeInTheDocument()
    expect(screen.getByText('기타 · 기타 사유')).toBeInTheDocument()
    expect(screen.queryByText('연가 · 정기 연가')).not.toBeInTheDocument()

    vi.useRealTimers()
  })
})
