import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { AuthContext } from '../auth/authContext'
import { LoginPage } from './LoginPage'

describe('이메일 링크 로그인', () => {
  it('이메일로 로그인 링크를 요청하고 다음 행동을 안내한다', async () => {
    const requestLoginLink = vi.fn().mockResolvedValue({ ok: true })

    render(
      <AuthContext value={{
        status: 'unauthenticated',
        user: null,
        requestLoginLink,
        signOut: vi.fn(),
      }}>
        <LoginPage />
      </AuthContext>,
    )

    fireEvent.change(screen.getByLabelText('이메일'), {
      target: { value: 'tester@example.com' },
    })
    fireEvent.click(screen.getByRole('button', { name: '로그인 링크 받기' }))

    await waitFor(() => expect(requestLoginLink).toHaveBeenCalledWith('tester@example.com'))
    expect(screen.getByText(/이메일의 링크를 눌러 앱으로 돌아오세요/)).toBeInTheDocument()
    expect(screen.queryByLabelText('인증 코드')).not.toBeInTheDocument()
  })
})
