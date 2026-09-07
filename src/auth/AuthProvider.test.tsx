import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
}))

vi.mock('../server/supabaseClient', () => ({
  isServerMode: true,
  supabase: {
    auth: {
      getSession: authMocks.getSession,
      onAuthStateChange: authMocks.onAuthStateChange,
      signInWithOAuth: authMocks.signInWithOAuth,
      signOut: authMocks.signOut,
    },
  },
}))

import { useAuth } from './authContext'
import { AuthProvider } from './AuthProvider'

function AuthConsumer() {
  const { signInWithGoogle, status } = useAuth()
  const [message, setMessage] = useState('')
  return (
    <>
      <button
        onClick={() => void signInWithGoogle().then((result) => setMessage(result.message ?? 'ok'))}
        type="button"
      >
        {status}
      </button>
      <p>{message}</p>
    </>
  )
}

describe('AuthProvider Google 로그인', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authMocks.getSession.mockResolvedValue({ data: { session: null } })
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    })
    authMocks.signInWithOAuth.mockResolvedValue({ data: { url: 'https://accounts.google.com' }, error: null })
  })

  it('Google provider와 현재 origin을 사용해 OAuth를 시작한다', async () => {
    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: 'unauthenticated' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'unauthenticated' }))

    await waitFor(() => expect(authMocks.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    }))
  })

  it('네트워크 예외를 재시도 가능한 결과로 바꾼다', async () => {
    authMocks.signInWithOAuth.mockRejectedValue(new Error('network error'))

    render(
      <AuthProvider>
        <AuthConsumer />
      </AuthProvider>,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: 'unauthenticated' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'unauthenticated' }))

    expect(await screen.findByText('네트워크 연결을 확인하고 Google 로그인을 다시 시도해주세요.')).toBeInTheDocument()
  })
})
