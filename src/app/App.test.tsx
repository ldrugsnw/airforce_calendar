import { fireEvent, render, screen } from '@testing-library/react'
import { StrictMode } from 'react'
import { MemoryRouter } from 'react-router'
import { App } from './App'
import { APP_STORAGE_KEY, ONBOARDING_STORAGE_KEY, saveAppState } from '../store/appStorage'

describe('앱 기본 화면 이동', () => {
  it('하단 내비게이션으로 홈, 달력, 내 휴가 화면을 이동한다', () => {
    saveAppState({ leaveGrants: [], leaveUsages: [], outings: [] })
    render(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )

    expect(screen.getByRole('heading', { name: '홈' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: '주요 화면' })).toHaveClass(
      'bottom-navigation',
      'bottom-0',
      'bg-white',
    )

    fireEvent.click(screen.getByRole('link', { name: '달력' }))
    expect(screen.getByRole('heading', { name: '달력' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('link', { name: '내 휴가' }))
    expect(screen.getByRole('heading', { name: '내 휴가' })).toBeInTheDocument()
  })

  it('완전히 새로운 로컬 사용자는 제품 소개 화면을 보고 하단 내비게이션은 보이지 않는다', () => {
    render(<MemoryRouter><App /></MemoryRouter>)

    expect(screen.getByText('1/3 · 시작')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '공군 휴가, 받는 날부터 쓰는 날까지' })).toBeInTheDocument()
    expect(screen.getByText('보유 휴가를 기록하고 전역 전까지 사용할 날짜를 한눈에 계획해보세요.')).toBeInTheDocument()
    expect(screen.getByText('현재는 공군 휴가 관리를 지원하고 있어요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '내 휴가 설정하기' })).toBeInTheDocument()
    expect(screen.getByText('약 1분 소요 · 언제든 수정할 수 있어요')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '주요 화면' })).not.toBeInTheDocument()
  })

  it.each([1, 2, 3])('유효한 기존 v%d 데이터 사용자는 온보딩을 건너뛴다', (version) => {
    const data = version === 1
      ? { version, leaveGrants: [] }
      : version === 2
        ? { version, leaveGrants: [], leaveUsages: [] }
        : { version, leaveGrants: [], leaveUsages: [], outings: [] }
    localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(data))

    render(<MemoryRouter><App /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '홈' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '공군 휴가, 받는 날부터 쓰는 날까지' })).not.toBeInTheDocument()
  })

  it('온보딩 완료 상태는 새로고침 후 앱 주요 화면을 표시한다', () => {
    saveAppState({ leaveGrants: [], leaveUsages: [], outings: [] })
    localStorage.setItem(ONBOARDING_STORAGE_KEY, JSON.stringify({
      version: 1,
      branch: 'air_force',
      leaveSetupCompletedAt: '2026-09-29T00:00:00.000Z',
    }))

    render(<MemoryRouter><App /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '홈' })).toBeInTheDocument()
  })

  it('브라우저가 캐시 저장소 접근을 거부해도 신규 사용자 화면을 표시한다', () => {
    const lengthSpy = vi.spyOn(Storage.prototype, 'length', 'get')
      .mockImplementation(() => {
        throw new DOMException('Access denied', 'SecurityError')
      })

    try {
      render(
        <StrictMode>
          <MemoryRouter>
            <App />
          </MemoryRouter>
        </StrictMode>,
      )

      expect(screen.getByRole('heading', { name: '공군 휴가, 받는 날부터 쓰는 날까지' })).toBeInTheDocument()
    } finally {
      lengthSpy.mockRestore()
    }
  })

  it('공군 시작을 저장하고 새로고침 후 기본 휴가 검토를 복원한다', () => {
    const { unmount } = render(<MemoryRouter><App /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '내 휴가 설정하기' }))

    expect(JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? 'null')).toEqual({
      version: 1,
      branch: 'air_force',
      leaveSetupCompletedAt: null,
    })
    expect(screen.getByRole('heading', { name: '현재 보유 휴가를 등록해주세요' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: '연가 포함' })).toBeChecked()
    expect(screen.queryByRole('navigation', { name: '주요 화면' })).not.toBeInTheDocument()

    unmount()
    render(<MemoryRouter><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '현재 보유 휴가를 등록해주세요' })).toBeInTheDocument()
  })

  it('Supabase 모드에서는 로컬 신규 사용자여도 온보딩 gate를 적용하지 않는다', async () => {
    vi.resetModules()
    vi.doMock('../server/supabaseClient', () => ({ isServerMode: true, supabase: null }))
    const { App: ServerModeApp } = await import('./App')
    render(<MemoryRouter><ServerModeApp /></MemoryRouter>)

    expect(screen.queryByRole('heading', { name: '공군 휴가, 받는 날부터 쓰는 날까지' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '내 휴가 설정하기' })).not.toBeInTheDocument()
    vi.doUnmock('../server/supabaseClient')
    vi.resetModules()
  })
})
