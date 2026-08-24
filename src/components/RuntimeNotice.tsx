import { useState } from 'react'
import { useAppRuntime } from '../store/appRuntimeContext'

export function RuntimeNotice() {
  const runtime = useAppRuntime()
  const [migrationMessage, setMigrationMessage] = useState<string | null>(null)

  return (
    <>
      {runtime.status === 'offlineReadonly' && (
        <div className="mb-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900" role="status">
          {runtime.message}
          <button className="ml-2 font-semibold underline" onClick={() => void runtime.retry()} type="button">
            다시 연결
          </button>
        </div>
      )}
      {runtime.status === 'ready' && runtime.message && (
        <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800" role="alert">
          {runtime.message}
        </div>
      )}
      {runtime.hasLocalMigration && (
        <section className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4" aria-labelledby="migration-title">
          <h2 className="font-bold text-blue-950" id="migration-title">기존 기기 데이터가 있어요</h2>
          <p className="mt-1 text-sm leading-6 text-blue-800">
            서버 계정이 비어 있다면 기존 휴가와 외출을 한 번에 이전할 수 있습니다.
          </p>
          {migrationMessage && <p className="mt-2 text-sm text-red-700" role="alert">{migrationMessage}</p>}
          <div className="mt-3 flex gap-2">
            <button
              className="min-h-11 flex-1 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white disabled:opacity-60"
              disabled={runtime.isSaving}
              onClick={() => void runtime.migrateLocalData().then((result) => {
                if (!result.ok) setMigrationMessage(result.message ?? '이전하지 못했습니다.')
              })}
              type="button"
            >
              이전하기
            </button>
            <button
              className="min-h-11 flex-1 rounded-xl border border-blue-200 bg-white px-3 text-sm font-semibold text-blue-800"
              onClick={runtime.dismissMigration}
              type="button"
            >
              나중에
            </button>
          </div>
        </section>
      )}
    </>
  )
}
