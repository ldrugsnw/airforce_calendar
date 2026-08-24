import type { ReactNode } from 'react'
import { NavLink } from 'react-router'

type NavigationItem = {
  label: string
  path: string
  end?: boolean
  icon: ReactNode
}

const navigationItems: NavigationItem[] = [
  {
    label: '홈',
    path: '/',
    end: true,
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m3 10.5 9-7.5 9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5Z"
      />
    ),
  },
  {
    label: '달력',
    path: '/calendar',
    icon: (
      <>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M6 2v3m12-3v3M3.5 9h17"
        />
        <rect width="17" height="17" x="3.5" y="4" rx="2" />
      </>
    ),
  },
  {
    label: '내 휴가',
    path: '/leave',
    icon: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M5 21a7 7 0 0 1 14 0"
        />
      </>
    ),
  },
  {
    label: '계정',
    path: '/account',
    icon: (
      <>
        <circle cx="12" cy="8" r="3" />
        <path strokeLinecap="round" d="M6.5 20a5.5 5.5 0 0 1 11 0" />
      </>
    ),
  },
]

export function BottomNavigation() {
  return (
    <nav
      aria-label="주요 화면"
      className="bottom-navigation fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-lg border-t border-slate-200 bg-white px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_12px_rgba(15,23,42,0.04)]"
    >
      <ul className="grid grid-cols-4 gap-2">
        {navigationItems.map((item) => (
          <li key={item.path}>
            <NavLink
              className={({ isActive }) =>
                `flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition-colors ${
                  isActive
                    ? 'bg-brand-50 text-brand-600'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`
              }
              end={item.end}
              to={item.path}
            >
              <svg
                aria-hidden="true"
                className="size-5 fill-none stroke-current stroke-2"
                viewBox="0 0 24 24"
              >
                {item.icon}
              </svg>
              <span>{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
