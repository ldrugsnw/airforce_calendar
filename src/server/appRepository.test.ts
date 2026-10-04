import { normalizeMigrationIds } from './appRepository'
import type { StoredAppData } from '../store/appStorage'

it('기존 로컬 온보딩의 문자열 ID를 UUID로 이전하며 휴가 사용 참조와 원본을 보존한다', () => {
  const now = new Date().toISOString()
  const data: StoredAppData = {
    version: 3,
    leaveGrants: [{ id: 'air-force-onboarding-annual', type: 'annual', days: 24,
      acquiredDate: null, reason: '', memo: '', createdAt: now, updatedAt: now }],
    leaveUsages: [{ id: crypto.randomUUID(), leaveGrantId: 'air-force-onboarding-annual',
      startDate: '2026-10-10', endDate: '2026-10-11', canceled: false, canceledAt: null,
      createdAt: now, updatedAt: now }],
    outings: [],
  }
  const result = normalizeMigrationIds(data) as StoredAppData
  expect(result.leaveGrants[0].id).toMatch(/^[0-9a-f-]{36}$/)
  expect(result.leaveUsages[0].leaveGrantId).toBe(result.leaveGrants[0].id)
  expect(result.leaveUsages[0].id).toBe(data.leaveUsages[0].id)
  expect(data.leaveGrants[0].id).toBe('air-force-onboarding-annual')
})
