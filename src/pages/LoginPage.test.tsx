import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AuthContext } from '../auth/authContext'
import { LoginPage } from './LoginPage'

describe('Google 로그인', () => {
  it('Google OAuth 로그인을 시작한다', async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue({ ok: true })

    render(
      <AuthContext value={{
        status: 'unauthenticated',
        user: null,
        signInWithGoogle,
        signOut: vi.fn(),
      }}>
        <LoginPage />
      </AuthContext>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Google로 계속하기' }))

    await waitFor(() => expect(signInWithGoogle).toHaveBeenCalledOnce())
    expect(screen.getByRole('button', { name: 'Google로 이동 중…' })).toBeDisabled()
  })

  it('로그인 시작 오류를 안내하고 다시 시도할 수 있게 한다', async () => {
    const signInWithGoogle = vi.fn().mockResolvedValue({
      ok: false,
      message: 'Google 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해주세요.',
    })

    render(
      <AuthContext value={{
        status: 'unauthenticated',
        user: null,
        signInWithGoogle,
        signOut: vi.fn(),
      }}>
        <LoginPage />
      </AuthContext>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Google로 계속하기' }))

    expect(await screen.findByRole('status')).toHaveTextContent('Google 로그인을 시작하지 못했습니다')
    expect(screen.getByRole('button', { name: 'Google로 계속하기' })).toBeEnabled()
  })

  it('Google 동의 화면에서 취소해 돌아온 경우를 안내한다', () => {
    window.history.replaceState({}, '', '/?error=access_denied')

    render(
      <AuthContext value={{
        status: 'unauthenticated',
        user: null,
        signInWithGoogle: vi.fn(),
        signOut: vi.fn(),
      }}>
        <LoginPage />
      </AuthContext>,
    )

    expect(screen.getByRole('status')).toHaveTextContent('Google 로그인이 취소되었습니다')
    window.history.replaceState({}, '', '/')
  })
})
