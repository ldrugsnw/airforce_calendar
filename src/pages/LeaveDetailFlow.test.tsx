import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from '../app/App'
import type { LeaveGrant } from '../domain/leave'
import type { LeaveUsage } from '../domain/leaveUsage'
import { loadAppState, saveAppState } from '../store/appStorage'

const leaveGrant: LeaveGrant = {
  id: 'leave-grant-1',
  type: 'consolation',
  days: 2,
  acquiredDate: '2026-08-03',
  reason: '주 40시간 근무',
  memo: '첫 번째 기록',
  createdAt: '2026-08-03T00:00:00.000Z',
  updatedAt: '2026-08-03T00:00:00.000Z',
}

describe('보유 휴가 상세·수정·삭제 흐름', () => {
  it('상세에 날짜 기준 완료·예정·사용 가능 합계를 표시한다', () => {
    const summaryGrant = { ...leaveGrant, days: 5 }
    const leaveUsages: LeaveUsage[] = [
      {
        id: 'completed-usage',
        leaveGrantId: leaveGrant.id,
        startDate: '2020-01-01',
        endDate: '2020-01-02',
        canceled: false,
        canceledAt: null,
        createdAt: '2020-01-01T00:00:00.000Z',
        updatedAt: '2020-01-01T00:00:00.000Z',
      },
      {
        id: 'scheduled-usage',
        leaveGrantId: leaveGrant.id,
        startDate: '2030-01-01',
        endDate: '2030-01-01',
        canceled: false,
        canceledAt: null,
        createdAt: '2026-08-01T00:00:00.000Z',
        updatedAt: '2026-08-01T00:00:00.000Z',
      },
    ]
    saveAppState({ leaveGrants: [summaryGrant], leaveUsages, outings: [] })

    render(
      <MemoryRouter initialEntries={['/leave/leave-grant-1']}>
        <App />
      </MemoryRouter>,
    )

    const summarySection = screen.getByRole('heading', {
      name: '휴가 일수 현황',
    }).closest('section')

    if (!summarySection) throw new Error('휴가 일수 현황을 찾지 못했습니다.')

    expect(within(summarySection).getByText('총 획득').parentElement).toHaveTextContent('5일')
    expect(within(summarySection).getByText('사용 완료').parentElement).toHaveTextContent('2일')
    expect(within(summarySection).getByText('사용 예정').parentElement).toHaveTextContent('1일')
    expect(within(summarySection).getByText('사용 가능').parentElement).toHaveTextContent('2일')
  })

  it('상세에서 보유 휴가를 수정하고 저장한다', async () => {
    saveAppState({ leaveGrants: [leaveGrant], leaveUsages: [], outings: [] })
    render(
      <MemoryRouter initialEntries={['/leave/leave-grant-1']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByText('주 40시간 근무')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('link', { name: '수정' }))
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '4' },
    })
    fireEvent.change(screen.getByLabelText(/획득 사유/), {
      target: { value: '수정된 사유' },
    })
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }))

    expect(
      await screen.findByRole('heading', { name: '보유 휴가 상세' }),
    ).toBeInTheDocument()
    expect(screen.getByText('수정된 사유')).toBeInTheDocument()

    await waitFor(() => {
      expect(loadAppState().leaveGrants[0]).toMatchObject({
        days: 4,
        reason: '수정된 사유',
      })
    })
  })

  it('확인 후 보유 휴가를 삭제한다', async () => {
    saveAppState({ leaveGrants: [leaveGrant], leaveUsages: [], outings: [] })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(
      <MemoryRouter initialEntries={['/leave/leave-grant-1']}>
        <App />
      </MemoryRouter>,
    )

    fireEvent.click(screen.getByRole('button', { name: '삭제' }))

    expect(
      await screen.findByRole('heading', { name: '내 휴가' }),
    ).toBeInTheDocument()
    expect(screen.getByText('등록된 보유 휴가가 없어요')).toBeInTheDocument()

    await waitFor(() => {
      expect(loadAppState().leaveGrants).toEqual([])
    })
    confirmSpy.mockRestore()
  })

  it('사용 기록이 연결된 보유 휴가의 삭제와 획득 일수 축소를 차단한다', async () => {
    const leaveUsage: LeaveUsage = {
      id: 'leave-usage-1',
      leaveGrantId: leaveGrant.id,
      startDate: '2026-08-08',
      endDate: '2026-08-09',
      canceled: false,
      canceledAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    saveAppState({
      leaveGrants: [leaveGrant],
      leaveUsages: [leaveUsage],
      outings: [],
    })
    render(
      <MemoryRouter initialEntries={['/leave/leave-grant-1']}>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('button', { name: '삭제' })).toBeDisabled()
    expect(
      screen.getByText(/위 사용 내역을 눌러 일정을 모두 취소/),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '연결된 사용 내역' })).toBeInTheDocument()
    expect(screen.getByText('1건')).toBeInTheDocument()
    expect(screen.getByText('양 끝 날짜 포함 · 2일')).toBeInTheDocument()

    fireEvent.click(
      screen.getByRole('link', {
        name: /2026년 8월 8일부터 2026년 8월 9일까지 2일 사용 일정 보기/,
      }),
    )
    expect(screen.getByRole('heading', { name: '2026년 8월' })).toBeInTheDocument()
    expect(screen.queryByText('선택한 개별 기록')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '내 휴가' }))
    fireEvent.click(
      screen.getByRole('link', { name: '위로휴가 2일 상세 보기' }),
    )

    fireEvent.click(screen.getByRole('link', { name: '수정' }))
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: '1' },
    })
    fireEvent.click(screen.getByRole('button', { name: '변경사항 저장' }))

    expect(screen.getByRole('alert')).toHaveTextContent(
      '이미 2일의 사용 일정이 연결되어 있어',
    )
    expect(screen.getByRole('heading', { name: '보유 휴가 수정' })).toBeInTheDocument()

    await waitFor(() => {
      expect(loadAppState().leaveGrants[0].days).toBe(2)
    })
  })

  it('존재하지 않는 기록 주소는 내 휴가로 돌려보낸다', async () => {
    render(
      <MemoryRouter initialEntries={['/leave/missing']}>
        <App />
      </MemoryRouter>,
    )

    expect(
      await screen.findByRole('heading', { name: '내 휴가' }),
    ).toBeInTheDocument()
  })
})
