import type { LeaveGrant } from '../domain/leave'
import type { Outing } from '../domain/outing'
import {
  APP_STORAGE_KEY,
  ONBOARDING_STORAGE_KEY,
  getLocalDataForMigration,
  hasValidExistingAppData,
  isNewLocalUser,
  loadAppState,
  loadOnboardingState,
  saveAppState,
  saveOnboardingState,
} from './appStorage'

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

  it.each([1, 2, 3])('기존 v%d 기기 기록을 원본 변경 없이 이전용 v3로 읽는다', (version) => {
    const raw = JSON.stringify({ version, leaveGrants: [leaveGrant], leaveUsages: [], outings: [] })
    localStorage.setItem(APP_STORAGE_KEY, raw)
    expect(getLocalDataForMigration()).toEqual({ version: 3, leaveGrants: [leaveGrant], leaveUsages: [], outings: [] })
    expect(localStorage.getItem(APP_STORAGE_KEY)).toBe(raw)
  })

  it('두 저장 키가 없으면 온보딩 상태가 없고 신규 로컬 사용자로 판단한다', () => {
    expect(loadOnboardingState()).toBeNull()
    expect(isNewLocalUser()).toBe(true)
  })

  it('온보딩 상태를 안전하게 저장하고 복원한다', () => {
    const state = {
      version: 1 as const,
      branch: 'air_force' as const,
      leaveSetupCompletedAt: '2026-09-28T00:00:00.000Z',
    }

    expect(saveOnboardingState(state)).toBe(true)
    expect(loadOnboardingState()).toEqual(state)
    expect(isNewLocalUser()).toBe(false)
  })

  it.each([
    '{invalid json',
    JSON.stringify({ version: 2, branch: 'air_force', leaveSetupCompletedAt: null }),
    JSON.stringify({ version: 1, branch: 'army', leaveSetupCompletedAt: null }),
    JSON.stringify({ version: 1, branch: null, leaveSetupCompletedAt: 'not-a-date' }),
    JSON.stringify({ version: 1, branch: null, leaveSetupCompletedAt: '2026-02-30T00:00:00.000Z' }),
    JSON.stringify({ version: 1, branch: null }),
  ])('잘못된 온보딩 데이터는 복원하지 않는다: %s', (value) => {
    localStorage.setItem(ONBOARDING_STORAGE_KEY, value)

    expect(loadOnboardingState()).toBeNull()
    expect(isNewLocalUser()).toBe(false)
  })

  it('유효한 기존 1·2·3형식 앱 데이터를 기존 사용자로 판단한다', () => {
    const storedVersions = [
      { version: 1, leaveGrants: [leaveGrant] },
      { version: 2, leaveGrants: [leaveGrant], leaveUsages: [] },
      { version: 3, leaveGrants: [leaveGrant], leaveUsages: [], outings: [] },
    ]

    for (const storedData of storedVersions) {
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(storedData))
      expect(hasValidExistingAppData()).toBe(true)
      expect(isNewLocalUser()).toBe(false)
      localStorage.removeItem(APP_STORAGE_KEY)
    }
  })

  it.each([
    '{invalid json',
    JSON.stringify({ version: 99, leaveGrants: [] }),
    JSON.stringify({ version: 1, leaveGrants: [{ ...leaveGrant, days: 0 }] }),
    JSON.stringify({ version: 2, leaveGrants: [leaveGrant] }),
    JSON.stringify({ version: 3, leaveGrants: [], leaveUsages: [], outings: 'invalid' }),
  ])('손상되거나 지원하지 않는 앱 데이터는 기존 데이터로 인정하지 않는다: %s', (value) => {
    localStorage.setItem(APP_STORAGE_KEY, value)

    expect(hasValidExistingAppData()).toBe(false)
    expect(isNewLocalUser()).toBe(false)
  })

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
