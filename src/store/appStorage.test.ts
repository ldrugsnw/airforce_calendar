import type { LeaveGrant } from '../domain/leave'
import type { Outing } from '../domain/outing'
import { APP_STORAGE_KEY, loadAppState, saveAppState } from './appStorage'

describe('앱 상태 브라우저 저장', () => {
  const leaveGrant: LeaveGrant = {
    id: 'leave-grant-1',
    type: 'performance',
    days: 3,
    acquiredDate: '2026-08-03',
    reason: '성과제',
    memo: '첫 번째 기록',
    createdAt: '2026-08-03T00:00:00.000Z',
    updatedAt: '2026-08-03T00:00:00.000Z',
  }

  it('저장한 보유 휴가를 다시 불러온다', () => {
    saveAppState({ leaveGrants: [leaveGrant], leaveUsages: [], outings: [] })

    expect(loadAppState()).toEqual({
      leaveGrants: [leaveGrant],
      leaveUsages: [],
      outings: [],
    })
  })

  it('획득일이 없거나 미래인 휴가를 복원한다', () => {
    const grants: LeaveGrant[] = [
      { ...leaveGrant, id: 'no-date', acquiredDate: null },
      { ...leaveGrant, id: 'future-date', acquiredDate: '2999-12-31' },
    ]
    saveAppState({ leaveGrants: grants, leaveUsages: [], outings: [] })

    expect(loadAppState().leaveGrants).toEqual(grants)
  })

  it('획득 일수와 날짜 상한을 벗어난 저장 데이터를 거절한다', () => {
    localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        leaveGrants: [{ ...leaveGrant, days: 366, acquiredDate: '3000-01-01' }],
        leaveUsages: [],
        outings: [],
      }),
    )

    expect(loadAppState().leaveGrants).toEqual([])
  })

  it('공가 보유 휴가를 유효한 형식으로 복원한다', () => {
    const officialLeaveGrant: LeaveGrant = {
      ...leaveGrant,
      id: 'official-leave-grant',
      type: 'official',
      reason: '공무 수행',
    }

    saveAppState({
      leaveGrants: [officialLeaveGrant],
      leaveUsages: [],
      outings: [],
    })

    expect(loadAppState()).toEqual({
      leaveGrants: [officialLeaveGrant],
      leaveUsages: [],
      outings: [],
    })
  })

  it('1형식의 보유 휴가를 잃지 않고 2형식 상태로 불러온다', () => {
    localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({ version: 1, leaveGrants: [leaveGrant] }),
    )

    expect(loadAppState()).toEqual({
      leaveGrants: [leaveGrant],
      leaveUsages: [],
      outings: [],
    })
  })

  it('2형식의 휴가 데이터를 잃지 않고 외출 빈 목록을 보충한다', () => {
    localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        leaveGrants: [leaveGrant],
        leaveUsages: [],
      }),
    )

    expect(loadAppState()).toEqual({
      leaveGrants: [leaveGrant],
      leaveUsages: [],
      outings: [],
    })
  })

  it('3형식의 외출을 저장하고 복원한다', () => {
    const outing: Outing = {
      id: 'outing-1',
      date: '2026-08-12',
      reason: '개인 용무',
      canceled: false,
      canceledAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }

    saveAppState({ leaveGrants: [], leaveUsages: [], outings: [outing] })

    expect(loadAppState()).toEqual({
      leaveGrants: [],
      leaveUsages: [],
      outings: [outing],
    })
  })

  it('이해할 수 없는 데이터이면 빈 상태를 사용한다', () => {
    localStorage.setItem(APP_STORAGE_KEY, '{"version":99}')

    expect(loadAppState()).toEqual({
      leaveGrants: [],
      leaveUsages: [],
      outings: [],
    })
  })

  it('존재하지 않는 보유 휴가를 참조하는 사용 기록이면 빈 상태를 사용한다', () => {
    localStorage.setItem(
      APP_STORAGE_KEY,
      JSON.stringify({
        version: 2,
        leaveGrants: [],
        leaveUsages: [
          {
            id: 'leave-usage-1',
            leaveGrantId: 'missing-grant',
            startDate: '2026-08-08',
            endDate: '2026-08-10',
            canceled: false,
            canceledAt: null,
            createdAt: '2026-08-01T00:00:00.000Z',
            updatedAt: '2026-08-01T00:00:00.000Z',
          },
        ],
      }),
    )

    expect(loadAppState()).toEqual({
      leaveGrants: [],
      leaveUsages: [],
      outings: [],
    })
  })
})
