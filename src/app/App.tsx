import { Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from '../auth/AuthProvider'
import { useAuth } from '../auth/authContext'
import { AccountPage } from '../pages/AccountPage'
import { CalendarPage } from '../pages/CalendarPage'
import { HomePage } from '../pages/HomePage'
import { LeaveCreatePage } from '../pages/LeaveCreatePage'
import { LeaveDetailPage } from '../pages/LeaveDetailPage'
import { LeaveEditPage } from '../pages/LeaveEditPage'
import { LeavePage } from '../pages/LeavePage'
import { LoginPage } from '../pages/LoginPage'
import { AppStateProvider } from '../store/AppStateProvider'
import { useAppRuntime } from '../store/appRuntimeContext'
import { AppLayout } from './AppLayout'

function LoadingScreen({ message = '데이터를 불러오는 중입니다…' }: { message?: string }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-5">
      <p className="text-sm font-semibold text-slate-600" role="status">{message}</p>
    </main>
  )
}

function AuthenticatedRoutes() {
  const runtime = useAppRuntime()
  if (runtime.status === 'loading') return <LoadingScreen />
  if (runtime.status === 'error') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-5">
        <section className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-bold text-slate-950">데이터를 불러오지 못했습니다</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">{runtime.message}</p>
          <button className="mt-5 min-h-12 w-full rounded-2xl bg-brand-600 text-sm font-semibold text-white" onClick={() => void runtime.retry()} type="button">
            다시 시도
          </button>
        </section>
      </main>
    )
  }
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="leave/new" element={<LeaveCreatePage />} />
        <Route path="leave/:leaveGrantId" element={<LeaveDetailPage />} />
        <Route path="leave/:leaveGrantId/edit" element={<LeaveEditPage />} />
        <Route path="account" element={<AccountPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

function AppWithAuth() {
  const { status } = useAuth()
  if (status === 'initializing') return <LoadingScreen message="로그인 상태를 확인하는 중입니다…" />
  if (status === 'unauthenticated') return <LoginPage />
  return (
    <AppStateProvider>
      <AuthenticatedRoutes />
    </AppStateProvider>
  )
}

export function App() {
  return (
    <AuthProvider>
      <AppWithAuth />
    </AuthProvider>
  )
}
