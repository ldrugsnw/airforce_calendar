import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from './App'
import type { AppSnapshot, MutationResult } from '../server/appSnapshot'
import { saveAppState, ONBOARDING_STORAGE_KEY } from '../store/appStorage'

const mocks = vi.hoisted(() => ({
  load: vi.fn(), save: vi.fn(), plan: vi.fn(), migrate: vi.fn(),
  userId: '00000000-0000-4000-8000-000000000001',
}))
vi.mock('../server/supabaseClient', () => ({ isServerMode: true, supabase: null }))
vi.mock('../server/appRepository', async (original) => ({
  ...await original<typeof import('../server/appRepository')>(),
  serverAppRepository: { loadSnapshot: mocks.load, migrateLocalData: mocks.migrate },
  saveServerOnboarding: mocks.save,
  saveServerOnboardingPlan: mocks.plan,
}))
vi.mock('../auth/AuthProvider', async () => {
  const { AuthContext } = await import('../auth/authContext')
  return { AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <AuthContext value={{ status: 'authenticated', user: { id: mocks.userId } as never,
      signInWithGoogle: async () => ({ ok: true }), signOut: async () => {} }}>
      {children}
    </AuthContext>
  ) }
})

function empty(): AppSnapshot {
  return {
    account: { userId: mocks.userId, status: 'active', localMigrationCompletedAt: null,
      localMigrationFingerprint: null, onboardingCompletedAt: null, onboardingGrantIds: null },
    leaveGrants: [], leaveUsages: [], outings: [], syncedAt: new Date().toISOString(),
  }
}
const ids = { annual: '00000000-0000-4000-8000-000000000002', performance: '00000000-0000-4000-8000-000000000003' }
function completed(annual = 24, performance: number | null = 7): AppSnapshot {
  const snapshot = empty()
  snapshot.account.onboardingCompletedAt = new Date().toISOString()
  snapshot.account.onboardingGrantIds = ids
  snapshot.leaveGrants = (['annual', 'performance'] as const).flatMap((type) => {
    const days = type === 'annual' ? annual : performance
    return days === null ? [] : [{ id: ids[type], type, days, acquiredDate: null, reason: '', memo: '',
      createdAt: snapshot.syncedAt, updatedAt: snapshot.syncedAt, revision: 1 }]
  })
  return snapshot
}
function mount() { return render(<MemoryRouter><App /></MemoryRouter>) }
function days(label: string, value: number) {
  fireEvent.change(screen.getByRole('spinbutton', { name: `${label} 보유 일수` }), { target: { value: String(value) } })
}
async function start() {
  fireEvent.click(await screen.findByRole('button', { name: '내 휴가 설정하기' }))
  days('연가', 24)
  fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
  days('성과제', 7)
}
function submit() { fireEvent.click(screen.getByRole('button', { name: '이 휴가로 시작하기' })) }
async function summary() { await screen.findByRole('heading', { name: '기본 휴가 설정을 완료했어요' }) }

beforeEach(() => {
  mocks.userId = '00000000-0000-4000-8000-000000000001'
  mocks.load.mockReset().mockResolvedValue(empty())
  mocks.save.mockReset()
  mocks.plan.mockReset()
  mocks.migrate.mockReset()
})

describe('로그인 계정의 서버 온보딩', () => {
  it('서버 로딩이 끝나기 전에는 신규 사용자라고 판단하지 않는다', async () => {
    let resolve!: (snapshot: AppSnapshot) => void
    mocks.load.mockImplementation(() => new Promise<AppSnapshot>((done) => { resolve = done }))
    mount()
    expect(screen.getByRole('status')).toHaveTextContent('데이터를 불러오는 중')
    expect(screen.queryByRole('button', { name: '내 휴가 설정하기' })).not.toBeInTheDocument()
    await waitFor(() => expect(mocks.load).toHaveBeenCalledOnce())
    await act(async () => resolve(empty()))
    expect(await screen.findByRole('button', { name: '내 휴가 설정하기' })).toBeInTheDocument()
  })

  it('최초 저장·수정·선택 해제를 같은 서버 항목에 적용하고 달력으로 이동한다', async () => {
    mocks.save.mockResolvedValueOnce({ ok: true, snapshot: completed() })
    mocks.plan.mockResolvedValueOnce({ ok: true, snapshot: completed(20, 5) })
      .mockResolvedValueOnce({ ok: true, snapshot: completed(20, null) })
    mount()
    await start()
    submit()
    await summary()
    expect(mocks.save.mock.calls[0]).toEqual([expect.any(String), { annual: 24, performance: 7 }, { annual: 0, performance: 0 }])
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '연가·성과제 일수 수정하기' }))
    days('연가', 20); days('성과제', 5); submit()
    fireEvent.click(screen.getByRole('button', { name: '변경 내용을 확인했고 저장합니다' }))
    await summary()
    expect(mocks.plan.mock.calls[0][1]).toMatchObject({ confirmed: true, items: [
      { id: ids.annual, type: 'annual', days: 20 }, { id: ids.performance, type: 'performance', days: 5 },
    ] })
    fireEvent.click(screen.getByRole('button', { name: '이전 단계로 돌아가기' }))
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    submit()
    fireEvent.click(screen.getByRole('button', { name: '변경 내용을 확인했고 저장합니다' }))
    await summary()
    expect(mocks.plan.mock.calls[1][1].items[1]).toMatchObject({ id: ids.performance, days: null })
    fireEvent.click(screen.getByRole('button', { name: '첫 휴가 계획하기' }))
    expect(await screen.findByRole('heading', { name: '달력' })).toBeInTheDocument()
  })

  it('빠른 중복 클릭을 막고 실패 후 같은 요청 ID로 재시도한다', async () => {
    let resolve!: (result: MutationResult) => void
    mocks.save.mockImplementationOnce(() => new Promise<MutationResult>((done) => { resolve = done }))
      .mockResolvedValueOnce({ ok: true, snapshot: completed() })
    mount(); await start()
    const submitButton = screen.getByRole('button', { name: '이 휴가로 시작하기' })
    fireEvent.click(submitButton); fireEvent.click(submitButton)
    expect(mocks.save).toHaveBeenCalledOnce()
    expect(screen.getByRole('checkbox', { name: '성과제 등록' })).toBeDisabled()
    await act(async () => resolve({ ok: false, code: 'NETWORK_ERROR', message: '저장 실패' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('저장 실패')
    expect(screen.queryByRole('heading', { name: '기본 휴가 설정을 완료했어요' })).not.toBeInTheDocument()
    submit(); await summary()
    expect(mocks.save.mock.calls[0]).toEqual(mocks.save.mock.calls[1])
  })

  it('응답 유실 후 입력을 바꾼 재시도는 최신 revision을 읽고 입력을 유지한다', async () => {
    mocks.save.mockResolvedValueOnce({ ok: false, code: 'NETWORK_ERROR', message: '응답 유실' })
      .mockResolvedValueOnce({ ok: false, code: 'REVISION_CONFLICT', message: '최신 내용을 다시 불러왔습니다.' })
    mocks.plan.mockResolvedValueOnce({ ok: true, snapshot: completed(20, 7) })
    mount(); await start(); submit()
    await screen.findByRole('alert')
    mocks.load.mockResolvedValue(completed())
    days('연가', 20); submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('최신 내용을 다시 불러왔습니다')
    expect(screen.getByRole('spinbutton', { name: '연가 보유 일수' })).toHaveValue(20)
    expect(screen.queryByRole('heading', { name: '기본 휴가 설정을 완료했어요' })).not.toBeInTheDocument()
    submit()
    fireEvent.click(screen.getByRole('button', { name: '변경 내용을 확인했고 저장합니다' }))
    await summary()
    expect(mocks.plan.mock.calls[0][1].items[0]).toMatchObject({ id: ids.annual, days: 20 })
    expect(mocks.save.mock.calls[1][0]).not.toBe(mocks.save.mock.calls[0][0])
  })

  it('브라우저 캐시 쓰기가 차단돼도 서버 저장 성공으로 완료한다', async () => {
    const storage = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked') })
    mocks.save.mockResolvedValue({ ok: true, snapshot: completed() })
    try {
      mount(); await start(); submit(); await summary()
      expect(screen.getByText('24일')).toBeInTheDocument()
    } finally { storage.mockRestore() }
  })

  it.each(['기존 휴가', '이전 완료'])('%s가 있어도 새 온보딩 미완료 계정에는 소개부터 표시한다', async (kind) => {
    const snapshot = empty()
    if (kind === '기존 휴가') snapshot.leaveGrants = completed().leaveGrants
    if (kind === '이전 완료') snapshot.account.localMigrationCompletedAt = snapshot.syncedAt
    mocks.load.mockResolvedValue(snapshot)
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({ version: 1, branch: 'air_force', leaveSetupCompletedAt: snapshot.syncedAt }))
    mount()
    expect(await screen.findByRole('button', { name: '내 휴가 설정하기' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument()
  })

  it('실제로 새 온보딩을 완료한 계정은 기록이 비어 있어도 건너뛴다', async () => {
    const snapshot = empty()
    snapshot.account.onboardingCompletedAt = snapshot.syncedAt
    saveAppState({ leaveGrants: completed().leaveGrants, leaveUsages: [], outings: [] })
    mocks.load.mockResolvedValue(snapshot)
    mount()
    expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument()
  })

  it('이전 완료 계정의 기록이 비어 있어도 새 온보딩에서 휴가를 저장할 수 있다', async () => {
    const snapshot = empty()
    snapshot.account.localMigrationCompletedAt = snapshot.syncedAt
    mocks.load.mockResolvedValue(snapshot)
    mocks.plan.mockResolvedValue({ ok: true, snapshot: completed() })
    mount(); await start(); submit(); await summary()
    expect(mocks.plan).toHaveBeenCalledOnce()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('새로고침과 다른 계정 로그인은 해당 계정 서버 완료 상태를 다시 확인한다', async () => {
    mocks.load.mockResolvedValue(completed())
    const view = mount()
    expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument()
    view.unmount()
    mocks.userId = '00000000-0000-4000-8000-000000000004'
    mocks.load.mockResolvedValue(empty())
    mount()
    expect(await screen.findByRole('button', { name: '내 휴가 설정하기' })).toBeInTheDocument()
  })

  it('같은 계정의 인증 객체 갱신에는 입력을 유지하고 계정이 바뀌면 서버 상태부터 읽는다', async () => {
    const view = mount()
    await start()
    view.rerender(<MemoryRouter><App /></MemoryRouter>)
    expect(screen.getByRole('spinbutton', { name: '연가 보유 일수' })).toHaveValue(24)
    expect(mocks.load).toHaveBeenCalledOnce()
    mocks.userId = '00000000-0000-4000-8000-000000000004'
    mocks.load.mockResolvedValue(empty())
    view.rerender(<MemoryRouter><App /></MemoryRouter>)
    expect(screen.getByRole('status')).toHaveTextContent('데이터를 불러오는 중')
    expect(await screen.findByRole('button', { name: '내 휴가 설정하기' })).toBeInTheDocument()
    expect(mocks.load).toHaveBeenCalledTimes(2)
  })

  it('기기 기록도 소개 후 이어 쓰기를 선택하고 입력·완료 흐름을 진행한다', async () => {
    const local = { leaveGrants: completed().leaveGrants, leaveUsages: [], outings: [] }
    saveAppState(local)
    const before = localStorage.getItem('airforce-calendar:data')
    mocks.migrate.mockResolvedValue({ ok: true, snapshot: completed() })
    mocks.plan.mockResolvedValue({ ok: true, snapshot: completed() })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: '내 휴가 설정하기' }))
    expect(screen.getByRole('heading', { name: '기존 기록이 있어요' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '기존 기록 이어 쓰기' }))
    expect(await screen.findByRole('spinbutton', { name: '연가 보유 일수' })).toHaveValue(24)
    expect(mocks.migrate).toHaveBeenCalledOnce()
    expect(localStorage.getItem('airforce-calendar:data')).toBe(before)
    submit(); await summary()
  })

  it('기기 기록에서 새로 설정하기를 선택하면 이전이나 삭제 없이 빈 입력부터 시작한다', async () => {
    saveAppState({ leaveGrants: completed().leaveGrants, leaveUsages: [], outings: [] })
    const before = localStorage.getItem('airforce-calendar:data')
    mount()
    fireEvent.click(await screen.findByRole('button', { name: '내 휴가 설정하기' }))
    fireEvent.click(screen.getByRole('button', { name: '새로 설정하기' }))
    expect(screen.getByRole('spinbutton', { name: '연가 보유 일수' })).toHaveValue(null)
    expect(mocks.migrate).not.toHaveBeenCalled()
    expect(localStorage.getItem('airforce-calendar:data')).toBe(before)
  })

  it('기존 서버 기록을 새로 설정해도 확인 전에는 변경하지 않고 취소할 수 있다', async () => {
    const snapshot = completed()
    snapshot.account.onboardingCompletedAt = null
    snapshot.account.onboardingGrantIds = null
    mocks.load.mockResolvedValue(snapshot)
    mocks.plan.mockResolvedValue({ ok: true, snapshot: completed(20, null) })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: '내 휴가 설정하기' }))
    fireEvent.click(screen.getByRole('button', { name: '새로 설정하기' }))
    expect(screen.getByRole('spinbutton', { name: '연가 보유 일수' })).toHaveValue(null)
    expect(screen.getByRole('spinbutton', { name: '성과제 보유 일수' })).toHaveValue(null)
    expect(mocks.plan).not.toHaveBeenCalled()
    days('연가', 20)
    fireEvent.click(screen.getByRole('checkbox', { name: '성과제 등록' }))
    submit()
    expect(screen.getByRole('heading', { name: '기존 기록 변경 확인' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '변경 범위' })).toHaveTextContent('연가: 24일 → 20일')
    expect(screen.getByRole('list', { name: '변경 범위' })).toHaveTextContent('성과제: 7일 → 삭제')
    expect(mocks.plan).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '입력으로 돌아가기' }))
    expect(screen.getByRole('spinbutton', { name: '연가 보유 일수' })).toHaveValue(20)
    submit()
    fireEvent.click(screen.getByRole('button', { name: '변경 내용을 확인했고 저장합니다' }))
    await summary()
    expect(mocks.plan.mock.calls[0][1]).toMatchObject({ confirmed: true, items: [
      { id: ids.annual, days: 20 }, { id: ids.performance, days: null },
    ] })
  })

  it('같은 종류가 여러 건이면 각각 입력하고 포상휴가는 그대로 둔다', async () => {
    const snapshot = completed()
    snapshot.account.onboardingCompletedAt = null
    snapshot.account.onboardingGrantIds = null
    const second = { ...snapshot.leaveGrants[0], id: crypto.randomUUID(), days: 10, reason: '추가 연가' }
    const reward = { ...second, id: crypto.randomUUID(), type: 'reward' as const, days: 3 }
    snapshot.leaveGrants.push(second, reward)
    mocks.load.mockResolvedValue(snapshot)
    mount()
    fireEvent.click(await screen.findByRole('button', { name: '내 휴가 설정하기' }))
    fireEvent.click(screen.getByRole('button', { name: '기존 기록 이어 쓰기' }))
    expect(screen.getByRole('spinbutton', { name: '연가 1 보유 일수' })).toHaveValue(24)
    expect(screen.getByRole('spinbutton', { name: '연가 2 보유 일수' })).toHaveValue(10)
    expect(screen.getByText('그대로 유지되는 휴가: 포상휴가 3일')).toBeInTheDocument()
    days('연가 2', 9); submit()
    expect(screen.getByRole('list', { name: '변경 범위' })).toHaveTextContent('연가 2: 10일 → 9일')
    expect(mocks.plan).not.toHaveBeenCalled()
  })

  it('연결된 사용·예정 일수보다 작게 입력하거나 사용 중인 휴가를 선택 해제하면 막는다', async () => {
    const snapshot = completed()
    snapshot.account.onboardingCompletedAt = null
    snapshot.leaveUsages = [{ id: crypto.randomUUID(), leaveGrantId: ids.annual, startDate: '2026-10-10',
      endDate: '2026-10-12', canceled: false, canceledAt: null, revision: 1,
      createdAt: snapshot.syncedAt, updatedAt: snapshot.syncedAt }]
    mocks.load.mockResolvedValue(snapshot)
    mount()
    fireEvent.click(await screen.findByRole('button', { name: '내 휴가 설정하기' }))
    fireEvent.click(screen.getByRole('button', { name: '기존 기록 이어 쓰기' }))
    days('연가', 2); submit()
    expect(screen.getByRole('alert')).toHaveTextContent('사용·예정 3일 이상')
    fireEvent.click(screen.getByRole('checkbox', { name: '연가 등록' })); submit()
    expect(screen.getByRole('alert')).toHaveTextContent('사용·예정 일정 1건이 있어 삭제할 수 없습니다')
    expect(mocks.plan).not.toHaveBeenCalled()
  })

  it('확인 후 저장 실패는 완료하지 않으며 중복 클릭·재시도는 같은 요청을 사용한다', async () => {
    const snapshot = completed()
    snapshot.account.onboardingCompletedAt = null
    mocks.load.mockResolvedValue(snapshot)
    let resolve!: (result: MutationResult) => void
    mocks.plan.mockImplementationOnce(() => new Promise<MutationResult>((done) => { resolve = done }))
      .mockResolvedValueOnce({ ok: true, snapshot: completed(20, 7) })
    mount()
    fireEvent.click(await screen.findByRole('button', { name: '내 휴가 설정하기' }))
    fireEvent.click(screen.getByRole('button', { name: '기존 기록 이어 쓰기' }))
    days('연가', 20); submit()
    const confirm = screen.getByRole('button', { name: '변경 내용을 확인했고 저장합니다' })
    fireEvent.click(confirm); fireEvent.click(confirm)
    expect(mocks.plan).toHaveBeenCalledOnce()
    await act(async () => resolve({ ok: false, code: 'NETWORK_ERROR', message: '저장 실패' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('저장 실패')
    expect(screen.queryByRole('heading', { name: '기본 휴가 설정을 완료했어요' })).not.toBeInTheDocument()
    fireEvent.click(confirm); await summary()
    expect(mocks.plan.mock.calls[0]).toEqual(mocks.plan.mock.calls[1])
  })

  it('오프라인 캐시가 빈 계정이어도 쓰기 온보딩을 열지 않는다', async () => {
    localStorage.setItem(`airforce-calendar:server-cache:${mocks.userId}`, JSON.stringify(empty()))
    mocks.load.mockRejectedValue(new Error('offline'))
    mount()
    expect(await screen.findByRole('heading', { name: '홈' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('읽기 전용')
    expect(screen.queryByRole('button', { name: '내 휴가 설정하기' })).not.toBeInTheDocument()
  })
})
