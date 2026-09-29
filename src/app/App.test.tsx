import { fireEvent, render, screen } from '@testing-library/react'
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

  it('완전히 새로운 로컬 사용자는 공군 확인 화면을 보고 하단 내비게이션은 보이지 않는다', () => {
    render(<MemoryRouter><App /></MemoryRouter>)

    expect(screen.getByRole('heading', { name: '현재 공군에서 복무 중인가요?' })).toBeInTheDocument()
    expect(screen.getByText('현재는 공군 휴가 관리만 지원해요.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '공군으로 시작하기' })).toBeInTheDocument()
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
    expect(screen.queryByRole('heading', { name: '현재 공군에서 복무 중인가요?' })).not.toBeInTheDocument()
  })

  it('공군 시작을 저장하고 새로고침 후 설정 안내 상태를 복원한다', () => {
    const { unmount } = render(<MemoryRouter><App /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: '공군으로 시작하기' }))

    expect(JSON.parse(localStorage.getItem(ONBOARDING_STORAGE_KEY) ?? 'null')).toEqual({
      version: 1,
      branch: 'air_force',
      leaveSetupCompletedAt: null,
    })
    expect(screen.getByRole('heading', { name: '공군으로 설정했어요' })).toBeInTheDocument()
    expect(screen.getByText('다음 단계에서 기본 휴가를 설정합니다.')).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: '주요 화면' })).not.toBeInTheDocument()

    unmount()
    render(<MemoryRouter><App /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: '공군으로 설정했어요' })).toBeInTheDocument()
  })

  it('Supabase 모드에서는 로컬 신규 사용자여도 온보딩 gate를 적용하지 않는다', async () => {
    vi.resetModules()
    vi.doMock('../server/supabaseClient', () => ({ isServerMode: true, supabase: null }))
    const { App: ServerModeApp } = await import('./App')
    render(<MemoryRouter><ServerModeApp /></MemoryRouter>)

    expect(screen.queryByRole('heading', { name: '현재 공군에서 복무 중인가요?' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '공군으로 시작하기' })).not.toBeInTheDocument()
    vi.doUnmock('../server/supabaseClient')
    vi.resetModules()
  })
})
