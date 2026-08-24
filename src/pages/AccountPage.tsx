import { useAuth } from '../auth/authContext'
import { PageHeader } from '../components/PageHeader'

export function AccountPage() {
  const { user, signOut } = useAuth()
  return (
    <div>
      <PageHeader description="로그인한 계정과 기기 데이터를 관리합니다." title="계정" />
      <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-slate-500">로그인 이메일</p>
        <p className="mt-1 break-all font-semibold text-slate-950">
          {user?.email ?? '로컬 개발 모드'}
        </p>
        {user && (
          <button
            className="mt-6 min-h-12 w-full rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700"
            onClick={() => void signOut()}
            type="button"
          >
            로그아웃
          </button>
        )}
      </section>
    </div>
  )
}
