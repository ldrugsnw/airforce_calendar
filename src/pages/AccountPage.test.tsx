import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { App } from '../app/App'
import { AccountPage } from './AccountPage'
import { AuthContext } from '../auth/authContext'
import { CACHE_PREFIX, MIGRATION_BACKUP_PREFIX } from '../server/appCache'
import { APP_STORAGE_KEY, ONBOARDING_STORAGE_KEY, saveAppState, saveOnboardingState } from '../store/appStorage'

const mode = vi.hoisted(() => ({ isServerMode: false }))
vi.mock('../server/supabaseClient', () => ({
  get isServerMode() { return mode.isServerMode },
  supabase: null,
}))

function renderAccount() {
  return render(<MemoryRouter initialEntries={['/account']}><App /></MemoryRouter>)
}

function seedLocalData() {
  saveAppState({ leaveGrants: [], leaveUsages: [], outings: [] })
  saveOnboardingState({ version: 1, branch: 'air_force', leaveSetupCompletedAt: '2026-09-30T00:00:00.000Z' })
  localStorage.setItem(`${CACHE_PREFIX}user-1`, 'cache-1')
  localStorage.setItem(`${CACHE_PREFIX}user-2`, 'cache-2')
  localStorage.setItem(`${MIGRATION_BACKUP_PREFIX}user-1`, JSON.stringify({ data: {}, expiresAt: '2999-01-01T00:00:00.000Z' }))
}

describe('개발 전용 온보딩 초기화', () => {
  beforeEach(() => {
    vi.stubEnv('DEV', true)
    mode.isServerMode = false
    seedLocalData()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    sessionStorage.removeItem(APP_STORAGE_KEY)
    document.cookie = 'reset-test=; Max-Age=0; path=/'
  })

  it('개발 빌드의 로컬 모드에서 개발 도구와 초기화 버튼을 표시한다', () => {
    renderAccount()
    expect(screen.getByRole('heading', { name: '개발 도구' })).toBeInTheDocument()
    expect(screen.getByText('로컬 테스트 데이터를 삭제하고 온보딩을 처음부터 다시 확인합니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '온보딩 처음부터 테스트하기' })).toBeInTheDocument()
  })

  it('프로덕션 빌드에서는 개발 도구를 표시하지 않는다', () => {
    vi.stubEnv('DEV', false)
    renderAccount()
    expect(screen.queryByRole('heading', { name: '개발 도구' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '온보딩 처음부터 테스트하기' })).not.toBeInTheDocument()
  })

  it('Supabase 모드에서는 개발 빌드여도 개발 도구를 표시하지 않는다', () => {
    mode.isServerMode = true
    render(
      <AuthContext.Provider value={{ status: 'authenticated', user: null, signInWithGoogle: vi.fn(), signOut: vi.fn() }}>
        <AccountPage />
      </AuthContext.Provider>,
    )
    expect(screen.queryByRole('heading', { name: '개발 도구' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '온보딩 처음부터 테스트하기' })).not.toBeInTheDocument()
  })

  it('확인을 취소하면 모든 로컬 데이터를 그대로 유지한다', () => {
    const before = { ...localStorage }
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAccount()
    fireEvent.click(screen.getByRole('button', { name: '온보딩 처음부터 테스트하기' }))

    expect(confirm).toHaveBeenCalledWith('저장된 로컬 휴가와 온보딩 진행 상태를 모두 삭제할까요?')
    expect({ ...localStorage }).toEqual(before)
    expect(screen.getByRole('heading', { name: '계정' })).toBeInTheDocument()
  })

  it('확인하면 앱 소유 키만 삭제하고 루트를 새로 불러와 온보딩 첫 화면을 표시한다', () => {
    localStorage.setItem('unrelated', 'keep')
    localStorage.setItem('sb-test-auth-token', 'keep-auth')
    localStorage.setItem('airforce-calendar:other', 'keep-other')
    sessionStorage.setItem(APP_STORAGE_KEY, 'keep-session')
    document.cookie = 'reset-test=keep; path=/'
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const assign = vi.fn()
    const browserWindow = window
    vi.stubGlobal('window', new Proxy(browserWindow, {
      get(target, key) {
        return key === 'location' ? { assign } : Reflect.get(target, key, target)
      },
    }))
    const { unmount } = renderAccount()
    fireEvent.click(screen.getByRole('button', { name: '온보딩 처음부터 테스트하기' }))

    expect(localStorage.getItem(APP_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(ONBOARDING_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(`${CACHE_PREFIX}user-1`)).toBeNull()
    expect(localStorage.getItem(`${CACHE_PREFIX}user-2`)).toBeNull()
    expect(localStorage.getItem(`${MIGRATION_BACKUP_PREFIX}user-1`)).toBeNull()
    expect(localStorage.getItem('unrelated')).toBe('keep')
    expect(localStorage.getItem('sb-test-auth-token')).toBe('keep-auth')
    expect(localStorage.getItem('airforce-calendar:other')).toBe('keep-other')
    expect(sessionStorage.getItem(APP_STORAGE_KEY)).toBe('keep-session')
    expect(document.cookie).toContain('reset-test=keep')
    expect(assign).toHaveBeenCalledExactlyOnceWith('/')
    unmount()
    render(<MemoryRouter><App /></MemoryRouter>)
    expect(screen.getByText('1/3 · 시작')).toBeInTheDocument()
  })

  it.each(['access', 'enumeration', 'removal'])('저장소 %s가 실패해도 계정 화면을 유지하고 실패를 알린다', (failure) => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAccount()
    const denyAccess = () => {
      throw new DOMException('Access denied', 'SecurityError')
    }
    const storageSpy = failure === 'access'
      ? vi.spyOn(window, 'localStorage', 'get').mockImplementation(denyAccess)
      : failure === 'enumeration'
        ? vi.spyOn(Storage.prototype, 'length', 'get').mockImplementation(denyAccess)
        : vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(denyAccess)
    fireEvent.click(screen.getByRole('button', { name: '온보딩 처음부터 테스트하기' }))
    expect(screen.getByRole('heading', { name: '계정' })).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('로컬 테스트 데이터를 삭제하지 못했습니다.')
    storageSpy.mockRestore()
    expect(localStorage.getItem(APP_STORAGE_KEY)).not.toBeNull()
  })
})
