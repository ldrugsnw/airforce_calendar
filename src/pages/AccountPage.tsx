import { useState } from 'react'
import { useAuth } from '../auth/authContext'
import { PageHeader } from '../components/PageHeader'
import { isServerMode } from '../server/supabaseClient'
import { resetLocalTestData } from '../store/appStorage'

export function AccountPage() {
  const { user, signOut } = useAuth()
  const [resetError, setResetError] = useState<string | null>(null)

  function resetOnboarding() {
    if (!window.confirm('저장된 로컬 휴가와 온보딩 진행 상태를 모두 삭제할까요?')) return
    if (!resetLocalTestData()) {
      setResetError('로컬 테스트 데이터를 삭제하지 못했습니다. 브라우저 저장소 접근 설정을 확인한 뒤 다시 시도해주세요.')
      return
    }
    window.location.assign('/')
  }

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
      {import.meta.env.DEV && !isServerMode && (
        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm" aria-labelledby="development-tools-title">
          <h2 className="font-semibold text-slate-950" id="development-tools-title">개발 도구</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            로컬 테스트 데이터를 삭제하고 온보딩을 처음부터 다시 확인합니다.
          </p>
          <button
            className="mt-6 min-h-12 w-full rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700"
            onClick={resetOnboarding}
            type="button"
          >
            온보딩 처음부터 테스트하기
          </button>
          {resetError && <p className="mt-3 text-sm text-red-700" role="alert">{resetError}</p>}
        </section>
      )}
    </div>
  )
}
