import type { LeaveGrant } from '../domain/leave'
import type { Outing } from '../domain/outing'
import { appReducer, initialAppState } from './appReducer'

describe('appReducer', () => {
  const leaveGrant: LeaveGrant = {
    id: 'leave-grant-1',
    type: 'consolation',
    days: 2,
    acquiredDate: '2026-08-01',
    reason: '주 40시간 근무',
    memo: '',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  }

  it('보유 휴가를 기존 목록 뒤에 추가한다', () => {
    const nextState = appReducer(initialAppState, {
      type: 'leaveGrant/added',
      payload: leaveGrant,
    })

    expect(nextState.leaveGrants).toEqual([leaveGrant])
    expect(initialAppState.leaveGrants).toEqual([])
  })

  it('같은 id의 보유 휴가만 수정한다', () => {
    const updatedLeaveGrant = { ...leaveGrant, days: 4 }

    const nextState = appReducer(
      { leaveGrants: [leaveGrant], leaveUsages: [], outings: [] },
      { type: 'leaveGrant/updated', payload: updatedLeaveGrant },
    )

    expect(nextState.leaveGrants).toEqual([updatedLeaveGrant])
  })

  it('같은 id의 보유 휴가만 삭제한다', () => {
    const canceledUsage = {
      id: 'usage-1', leaveGrantId: leaveGrant.id,
      startDate: '2026-08-08' as const, endDate: '2026-08-08' as const,
      canceled: true, canceledAt: '2026-08-02T00:00:00.000Z',
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z',
    }
    const nextState = appReducer(
      { leaveGrants: [leaveGrant], leaveUsages: [canceledUsage], outings: [] },
      { type: 'leaveGrant/deleted', payload: { id: leaveGrant.id } },
    )

    expect(nextState.leaveGrants).toEqual([])
    expect(nextState.leaveUsages).toEqual([])
  })

  it('휴가 사용 기록을 기존 목록 뒤에 추가한다', () => {
    const leaveUsage = {
      id: 'leave-usage-1',
      leaveGrantId: leaveGrant.id,
      startDate: '2026-08-08' as const,
      endDate: '2026-08-10' as const,
      canceled: false,
      canceledAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }

    const nextState = appReducer(initialAppState, {
      type: 'leaveUsage/added',
      payload: leaveUsage,
    })

    expect(nextState.leaveUsages).toEqual([leaveUsage])
    expect(initialAppState.leaveUsages).toEqual([])
  })

  it('휴가 사용 기록을 수정하고 취소한다', () => {
    const leaveUsage = {
      id: 'leave-usage-1',
      leaveGrantId: leaveGrant.id,
      startDate: '2026-08-08' as const,
      endDate: '2026-08-10' as const,
      canceled: false,
      canceledAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    const updatedUsage = { ...leaveUsage, endDate: '2026-08-09' as const }
    const updatedState = appReducer(
      { leaveGrants: [leaveGrant], leaveUsages: [leaveUsage], outings: [] },
      { type: 'leaveUsage/updated', payload: updatedUsage },
    )
    const canceledState = appReducer(updatedState, {
      type: 'leaveUsage/canceled',
      payload: {
        id: leaveUsage.id,
        canceledAt: '2026-08-02T00:00:00.000Z',
      },
    })

    expect(updatedState.leaveUsages).toEqual([updatedUsage])
    expect(canceledState.leaveUsages[0]).toMatchObject({
      canceled: true,
      canceledAt: '2026-08-02T00:00:00.000Z',
    })
  })

  it('외출을 추가하고 수정한 뒤 취소한다', () => {
    const outing: Outing = {
      id: 'outing-1',
      date: '2026-08-12',
      reason: '개인 용무',
      canceled: false,
      canceledAt: null,
      createdAt: '2026-08-01T00:00:00.000Z',
      updatedAt: '2026-08-01T00:00:00.000Z',
    }
    const addedState = appReducer(initialAppState, {
      type: 'outing/added',
      payload: outing,
    })
    const updatedOuting = { ...outing, reason: '병원 진료' }
    const updatedState = appReducer(addedState, {
      type: 'outing/updated',
      payload: updatedOuting,
    })
    const canceledState = appReducer(updatedState, {
      type: 'outing/canceled',
      payload: { id: outing.id, canceledAt: '2026-08-02T00:00:00.000Z' },
    })

    expect(addedState.outings).toEqual([outing])
    expect(updatedState.outings).toEqual([updatedOuting])
    expect(canceledState.outings[0]).toMatchObject({
      canceled: true,
      canceledAt: '2026-08-02T00:00:00.000Z',
    })
  })
})
