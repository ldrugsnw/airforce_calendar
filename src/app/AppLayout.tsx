import { Outlet } from 'react-router'
import { BottomNavigation } from '../components/BottomNavigation'
import { RuntimeNotice } from '../components/RuntimeNotice'

export function AppLayout() {
  return (
    <div className="min-h-dvh bg-slate-50">
      <div className="app-shell mx-auto min-h-dvh w-full max-w-lg bg-white shadow-sm">
        <a
          className="fixed left-3 top-3 z-50 -translate-y-24 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition focus:translate-y-0"
          href="#main-content"
        >
          본문으로 바로가기
        </a>
        <main className="min-h-dvh px-5 pb-28 pt-8" id="main-content" tabIndex={-1}>
          <RuntimeNotice />
          <Outlet />
        </main>
        <BottomNavigation />
      </div>
    </div>
  )
}
