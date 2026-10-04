import { readFileSync } from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { act, cleanup, configure, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router'
import { App } from '../src/app/App'
import type { AppSnapshot } from '../src/server/appSnapshot'
import { APP_STORAGE_KEY, saveAppState } from '../src/store/appStorage'

// Opt-in only. This file never accepts a remote API URL or a production credential.
const connection = vi.hoisted(() => ({ client: null as SupabaseClient | null }))
vi.mock('../src/server/supabaseClient', () => ({
  isServerMode: true, get supabase() { return connection.client },
}))
const enabled = Boolean(process.env.AIRFORCE_LOCAL_SUPABASE_STATUS)
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe.skipIf(!enabled)('온보딩 UI → 실제 로컬 Supabase', () => {
  let admin: SupabaseClient
  let email: string
  let password: string
  let userId: string | undefined

  beforeAll(async () => {
    // Real Auth/HTTP work needs a longer wait than the default unit-test second.
    configure({ asyncUtilTimeout: 10_000 })
    const status = JSON.parse(readFileSync(process.env.AIRFORCE_LOCAL_SUPABASE_STATUS!, 'utf8'))
    const url = new URL(status.API_URL)
    if (!['127.0.0.1', 'localhost', '::1'].includes(url.hostname) || url.port !== '54321' || url.protocol !== 'http:') {
      throw new Error('Local Supabase at port 54321 required')
    }
    const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
    admin = createClient(url.href, status.SERVICE_ROLE_KEY, { auth: { ...options.auth, storageKey: 'airforce-integration-admin' } })
    connection.client = createClient(url.href, status.ANON_KEY, options)
    email = `onboarding-${crypto.randomUUID()}@example.com`
    password = crypto.randomUUID()
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    expect(created.error).toBeNull()
    userId = created.data.user!.id
    const login = await connection.client.auth.signInWithPassword({ email, password })
    expect(login.error).toBeNull()
  })

  afterAll(async () => {
    cleanup()
    if (connection.client) await connection.client.auth.signOut()
    if (userId) expect((await admin.auth.admin.deleteUser(userId)).error).toBeNull()
  })

  function CurrentPath() { return <output aria-label="현재 경로">{useLocation().pathname}</output> }
  function mount() { return render(<MemoryRouter><App /><CurrentPath /></MemoryRouter>) }
  async function snapshot(): Promise<AppSnapshot> {
    const result = await connection.client!.rpc('api_get_app_snapshot')
    expect(result.error).toBeNull()
    return result.data
  }
  function days(label: string, value: number) {
    fireEvent.change(screen.getByRole('spinbutton', { name: `${label} 보유 일수` }), { target: { value: String(value) } })
  }
  function submit() { fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' })) }
  async function summary() { await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' }) }
  async function saveChanges() {
    submit()
    const confirm = screen.queryByRole('button', { name: '변경 내용을 확인했고 저장합니다' })
    if (confirm) fireEvent.click(confirm)
    await summary()
  }
  function edit() { fireEvent.click(screen.getByRole('button', { name: '연가·성과제 일수 수정하기' })) }

  it('첫 저장, 수정, 선택 해제, 응답 유실 재시도, 재조회, 달력 이동, 재로그인을 확인한다', async () => {
    let view = mount()
    fireEvent.click(await screen.findByRole('button', { name: '내 휴가 설정하기' }))
    days('연가', 24)
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    days('성과제', 7)

    // Commit to the real DB, but lose both responses. The UI must stay on the form.
    const client = connection.client!
    const realRpc = client.rpc.bind(client)
    let lost = 0
    const spy = vi.spyOn(client, 'rpc').mockImplementation(((name: string, args: object) => {
      if (name === 'api_save_onboarding' && lost++ < 2) {
        return realRpc(name, args).then((result) => {
          expect(result.data.ok).toBe(true)
          return { ...result, data: null, error: { message: 'simulated lost response', code: 'NETWORK_ERROR' } }
        })
      }
      return realRpc(name, args)
    }) as typeof client.rpc)
    try {
      const submitButton = screen.getByRole('button', { name: '이 휴가로 시작하기' })
      fireEvent.click(submitButton); fireEvent.click(submitButton)
      expect(await screen.findByRole('alert')).toHaveTextContent('서버에 연결할 수 없습니다')
      expect(screen.queryByRole('heading', { name: '기본 휴가 설정을 완료했어요' })).not.toBeInTheDocument()
      const committed = await snapshot()
      expect(committed.leaveGrants.map((g) => g.days).sort((a, b) => a - b)).toEqual([7, 24])
      expect(committed.account.onboardingCompletedAt).not.toBeNull()
      expect(committed.leaveGrants.every((g) => uuidPattern.test(g.id))).toBe(true)
      await saveChanges()
      const retried = await snapshot()
      expect(retried.leaveGrants).toEqual(committed.leaveGrants)
      const requests = spy.mock.calls.filter(([name]) => name === 'api_save_onboarding')
      expect(requests).toHaveLength(3)
      expect(new Set(requests.map(([, args]) => args!.p_request_id)).size).toBe(1)
    } finally { spy.mockRestore() }

    const initial = await snapshot()
    edit(); days('연가', 20); days('성과제', 5); await saveChanges()
    const changed = await snapshot()
    expect(changed.leaveGrants).toHaveLength(2)
    for (const grant of changed.leaveGrants) {
      expect(grant.days).toBe(grant.type === 'annual' ? 20 : 5)
      expect(grant.id).toBe(initial.leaveGrants.find((g) => g.type === grant.type)!.id)
      expect(grant.createdAt).toBe(initial.leaveGrants.find((g) => g.type === grant.type)!.createdAt)
      expect(grant.revision).toBe(2)
    }
    edit(); fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' })); await saveChanges()
    expect((await snapshot()).leaveGrants).toEqual([expect.objectContaining({ type: 'annual', days: 20 })])
    edit(); fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' })); await saveChanges()
    expect((await snapshot()).leaveGrants).toHaveLength(2)
    expect((await snapshot()).leaveGrants.find((g) => g.type === 'performance')!.id).toBe(initial.account.onboardingGrantIds!.performance)
    edit(); fireEvent.click(screen.getByRole('checkbox', { name: '연가 등록' })); await saveChanges()
    expect((await snapshot()).leaveGrants).toEqual([expect.objectContaining({ type: 'performance', days: 5 })])
    edit(); fireEvent.click(screen.getByRole('checkbox', { name: '연가 등록' })); await saveChanges()
    expect((await snapshot()).leaveGrants.find((g) => g.type === 'annual')!.id).toBe(initial.account.onboardingGrantIds!.annual)
    fireEvent.click(screen.getByRole('button', { name: '첫 휴가 계획하기' }))
    expect(await screen.findByRole('heading', { name: '달력' })).toBeInTheDocument()
    expect(screen.getByLabelText('현재 경로')).toHaveTextContent('/calendar')
    expect(localStorage.getItem(APP_STORAGE_KEY)).toBeNull()

    view.unmount()
    localStorage.clear()
    view = mount()
    expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '내 휴가 설정하기' })).not.toBeInTheDocument()
    view.unmount()
    await act(async () => { await client.auth.signOut() })
    expect((await client.auth.signInWithPassword({ email, password })).error).toBeNull()
    mount()
    expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument()
    expect((await snapshot()).leaveGrants).toHaveLength(2)
  }, 30_000)

  it('기존 로컬 기록을 보존하며 이전한 뒤 입력·저장·달력까지 새 온보딩을 완료한다', async () => {
    const client = connection.client!
    await client.auth.signOut()
    const temporaryEmail = `migration-${crypto.randomUUID()}@example.com`
    const temporaryPassword = crypto.randomUUID()
    const created = await admin.auth.admin.createUser({ email: temporaryEmail, password: temporaryPassword, email_confirm: true })
    expect(created.error).toBeNull()
    const temporaryId = created.data.user!.id
    try {
      expect((await client.auth.signInWithPassword({ email: temporaryEmail, password: temporaryPassword })).error).toBeNull()
      const now = new Date().toISOString()
      const usageId = crypto.randomUUID()
      saveAppState({
        leaveGrants: [{ id: 'air-force-onboarding-annual', type: 'annual', days: 24,
          acquiredDate: null, reason: '', memo: '', createdAt: now, updatedAt: now }],
        leaveUsages: [{ id: usageId, leaveGrantId: 'air-force-onboarding-annual',
          startDate: '2026-10-10', endDate: '2026-10-11', canceled: false, canceledAt: null,
          createdAt: now, updatedAt: now }],
        outings: [],
      })
      const view = mount()
      fireEvent.click(await screen.findByRole('button', { name: '내 휴가 설정하기' }))
      fireEvent.click(screen.getByRole('button', { name: '기존 기록 이어 쓰기' }))
      await screen.findByRole('spinbutton', { name: '연가 보유 일수' })
      const migrated = await snapshot()
      expect(migrated.account.localMigrationCompletedAt).not.toBeNull()
      expect(migrated.leaveGrants).toHaveLength(1)
      expect(migrated.leaveGrants[0].id).toMatch(uuidPattern)
      expect(migrated.leaveUsages[0]).toMatchObject({ id: usageId, leaveGrantId: migrated.leaveGrants[0].id })
      expect(localStorage.getItem(APP_STORAGE_KEY)).not.toBeNull()
      expect(migrated.account.onboardingCompletedAt).toBeNull()
      await saveChanges()
      fireEvent.click(screen.getByRole('button', { name: '첫 휴가 계획하기' }))
      expect(await screen.findByRole('heading', { name: '달력' })).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: '내 휴가 설정하기' })).not.toBeInTheDocument()
      view.unmount()
      localStorage.clear()
      mount()
      expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument()
    } finally {
      cleanup()
      await client.auth.signOut()
      expect((await admin.auth.admin.deleteUser(temporaryId)).error).toBeNull()
    }
  })

  it('기존 서버 계정도 새로 설정·명시적 확인을 거치고 여러 휴가·사용 이력을 보존한다', async () => {
    const client = connection.client!
    await client.auth.signOut()
    const credentials = { email: `existing-${crypto.randomUUID()}@example.com`, password: crypto.randomUUID() }
    const created = await admin.auth.admin.createUser({ ...credentials, email_confirm: true })
    expect(created.error).toBeNull()
    const temporaryId = created.data.user!.id
    try {
      expect((await client.auth.signInWithPassword(credentials)).error).toBeNull()
      const grantIds = [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID()]
      for (const [index, type, count] of [[0, 'annual', 24], [1, 'annual', 10], [2, 'performance', 7], [3, 'reward', 3]] as const) {
        const result = await client.rpc('api_mutate_app', { p_request_id: crypto.randomUUID(), p_operation: 'leaveGrant/create',
          p_payload: { id: grantIds[index], type, days: count, acquiredDate: '2026-09-01', reason: `기존 ${index}`, memo: '유지할 메모' } })
        expect(result.error).toBeNull(); expect(result.data.ok).toBe(true)
      }
      const activeId = crypto.randomUUID()
      const canceledId = crypto.randomUUID()
      for (const [id, grantIndex, date] of [[activeId, 0, '2026-10-10'], [canceledId, 2, '2026-10-13']] as const) {
        const result = await client.rpc('api_mutate_app', { p_request_id: crypto.randomUUID(), p_operation: 'leaveUsage/create',
          p_payload: { id, leaveGrantId: grantIds[grantIndex], startDate: date, endDate: date } })
        expect(result.error).toBeNull(); expect(result.data.ok).toBe(true)
      }
      expect((await client.rpc('api_mutate_app', { p_request_id: crypto.randomUUID(), p_operation: 'leaveUsage/cancel',
        p_payload: { id: canceledId, expectedRevision: 1 } })).data.ok).toBe(true)
      const original = await snapshot()
      expect(original.account.onboardingCompletedAt).toBeNull()
      const view = mount()
      fireEvent.click(await screen.findByRole('button', { name: '내 휴가 설정하기' }))
      fireEvent.click(screen.getByRole('button', { name: '새로 설정하기' }))
      expect(screen.getByRole('spinbutton', { name: '연가 1 보유 일수' })).toHaveValue(null)
      days('연가 1', 20); days('연가 2', 9); days('성과제', 5)
      submit()
      expect(screen.getByRole('heading', { name: '기존 기록 변경 확인' })).toBeInTheDocument()
      expect((await snapshot()).leaveGrants).toEqual(original.leaveGrants)
      fireEvent.click(screen.getByRole('button', { name: '입력으로 돌아가기' }))
      expect(screen.getByRole('spinbutton', { name: '연가 1 보유 일수' })).toHaveValue(20)
      submit()

      const realRpc = client.rpc.bind(client)
      let lost = 0
      const spy = vi.spyOn(client, 'rpc').mockImplementation(((name: string, args: object) => {
        if (name === 'api_save_onboarding_plan' && lost++ < 2) return realRpc(name, args).then((result) => {
          expect(result.data.ok).toBe(true)
          return { ...result, data: null, error: { code: 'NETWORK_ERROR', message: 'simulated lost response' } }
        })
        return realRpc(name, args)
      }) as typeof client.rpc)
      try {
        fireEvent.click(screen.getByRole('button', { name: '변경 내용을 확인했고 저장합니다' }))
        expect(await screen.findByRole('alert')).toHaveTextContent('서버에 연결할 수 없습니다')
        const committed = await snapshot()
        expect(committed.leaveGrants).toHaveLength(4)
        expect(committed.leaveUsages).toEqual(original.leaveUsages)
        expect(committed.leaveGrants.find((g) => g.type === 'reward')).toEqual(original.leaveGrants.find((g) => g.type === 'reward'))
        for (const old of original.leaveGrants.filter((g) => g.type !== 'reward')) {
          expect(committed.leaveGrants.find((g) => g.id === old.id)).toMatchObject({
            id: old.id, acquiredDate: old.acquiredDate, reason: old.reason, memo: old.memo, createdAt: old.createdAt,
          })
        }
        fireEvent.click(screen.getByRole('button', { name: '변경 내용을 확인했고 저장합니다' }))
        await summary()
        expect((await snapshot()).leaveGrants).toEqual(committed.leaveGrants)
        const requests = spy.mock.calls.filter(([name]) => name === 'api_save_onboarding_plan')
        expect(requests).toHaveLength(3)
        expect(new Set(requests.map(([, args]) => args!.p_request_id)).size).toBe(1)
      } finally { spy.mockRestore() }

      edit(); fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' })); submit()
      expect(screen.getByRole('list', { name: '변경 범위' })).toHaveTextContent('취소 기록 1건 삭제')
      expect((await snapshot()).leaveGrants).toHaveLength(4)
      fireEvent.click(screen.getByRole('button', { name: '변경 내용을 확인했고 저장합니다' }))
      await summary()
      const final = await snapshot()
      expect(final.leaveGrants).toHaveLength(3)
      expect(final.leaveUsages).toEqual(original.leaveUsages.filter((u) => u.id === activeId))
      fireEvent.click(screen.getByRole('button', { name: '첫 휴가 계획하기' }))
      expect(await screen.findByRole('heading', { name: '달력' })).toBeInTheDocument()
      view.unmount()
      localStorage.clear()
      mount()
      expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument()
    } finally {
      cleanup()
      await client.auth.signOut()
      expect((await admin.auth.admin.deleteUser(temporaryId)).error).toBeNull()
    }
  }, 30_000)
})
