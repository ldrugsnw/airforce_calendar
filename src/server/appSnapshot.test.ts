import { getServerErrorMessage, isAppSnapshot, toServerErrorCode } from './appSnapshot'

describe('서버 스냅샷 계약', () => {
  it('revision과 계정 정보가 있는 전체 스냅샷을 허용한다', () => {
    expect(isAppSnapshot({
      account: {
        userId: 'user-1', status: 'active',
        localMigrationCompletedAt: null, localMigrationFingerprint: null,
      },
      leaveGrants: [{
        id: 'grant-1', type: 'annual', days: 3, acquiredDate: '2026-08-01',
        reason: '', memo: '', revision: 1,
      }],
      leaveUsages: [], outings: [], syncedAt: '2026-08-24T00:00:00.000Z',
    })).toBe(true)
  })

  it('revision이 없는 서버 원본을 거절한다', () => {
    expect(isAppSnapshot({
      account: {
        userId: 'user-1', status: 'active',
        localMigrationCompletedAt: null, localMigrationFingerprint: null,
      },
      leaveGrants: [{
        id: 'grant-1', type: 'annual', days: 3, acquiredDate: '2026-08-01',
        reason: '', memo: '',
      }],
      leaveUsages: [], outings: [], syncedAt: '2026-08-24T00:00:00.000Z',
    })).toBe(false)
  })

  it('획득일 null과 2999년의 미래 획득일을 허용한다', () => {
    const base = {
      account: {
        userId: 'user-1', status: 'active',
        localMigrationCompletedAt: null, localMigrationFingerprint: null,
      },
      leaveUsages: [], outings: [], syncedAt: '2026-08-24T00:00:00.000Z',
    }
    expect(isAppSnapshot({
      ...base,
      leaveGrants: [{ id: 'a', type: 'annual', days: 1, acquiredDate: null, reason: '', memo: '', revision: 1 }],
    })).toBe(true)
    expect(isAppSnapshot({
      ...base,
      leaveGrants: [{ id: 'b', type: 'annual', days: 1, acquiredDate: '2999-12-31', reason: '', memo: '', revision: 1 }],
    })).toBe(true)
  })

  it('알 수 없는 서버 오류를 안전한 공통 안내로 바꾼다', () => {
    expect(toServerErrorCode('REVISION_CONFLICT')).toBe('REVISION_CONFLICT')
    expect(toServerErrorCode('database details')).toBe('UNKNOWN_ERROR')
    expect(getServerErrorMessage('UNKNOWN_ERROR')).toContain('요청을 처리하지 못했습니다')
  })
})
