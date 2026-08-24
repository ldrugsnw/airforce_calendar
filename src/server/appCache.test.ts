import {
  clearServerCache,
  loadServerCache,
  removeExpiredMigrationBackups,
  saveMigrationBackup,
  saveServerCache,
} from './appCache'
import type { AppSnapshot } from './appSnapshot'

const snapshot: AppSnapshot = {
  account: {
    userId: 'user-1',
    status: 'active',
    localMigrationCompletedAt: null,
    localMigrationFingerprint: null,
  },
  leaveGrants: [
    {
      id: 'grant-1', type: 'annual', days: 3, acquiredDate: '2026-08-01',
      reason: '정기 연가', memo: '', revision: 1,
      createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z',
    },
  ],
  leaveUsages: [],
  outings: [],
  syncedAt: '2026-08-24T00:00:00.000Z',
}

describe('사용자별 서버 캐시', () => {
  it('검증된 스냅샷만 사용자별로 저장하고 삭제한다', () => {
    saveServerCache(snapshot)
    expect(loadServerCache('user-1')).toEqual(snapshot)
    expect(loadServerCache('user-2')).toBeNull()

    clearServerCache('user-1')
    expect(loadServerCache('user-1')).toBeNull()
  })

  it('손상된 캐시는 복원하지 않는다', () => {
    localStorage.setItem('airforce-calendar:server-cache:user-1', '{broken')
    expect(loadServerCache('user-1')).toBeNull()
  })

  it('만료된 이전 백업만 정리한다', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-01T00:00:00.000Z'))
    saveMigrationBackup('user-1', { version: 3 })
    expect(localStorage.getItem('airforce-calendar:migration-backup:user-1')).not.toBeNull()

    vi.setSystemTime(new Date('2026-08-09T00:00:00.000Z'))
    removeExpiredMigrationBackups()
    expect(localStorage.getItem('airforce-calendar:migration-backup:user-1')).toBeNull()
    vi.useRealTimers()
  })
})
