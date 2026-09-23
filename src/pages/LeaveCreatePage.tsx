import { useNavigate, useSearchParams } from 'react-router'
import {
  LeaveGrantForm,
  type LeaveGrantFormValues,
} from '../components/LeaveGrantForm'
import { SubPageHeader } from '../components/SubPageHeader'
import type { LeaveGrant } from '../domain/leave'
import { useAppDispatch } from '../store/appStateContext'

export function LeaveCreatePage() {
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestedReturnTo = searchParams.get('returnTo')
  const returnTo = getSafeReturnTo(requestedReturnTo)
  async function handleSubmit(values: LeaveGrantFormValues) {
    const now = new Date().toISOString()
    const leaveGrant: LeaveGrant = {
      id: crypto.randomUUID(),
      ...values,
      createdAt: now,
      updatedAt: now,
    }

    const result = await dispatch({ type: 'leaveGrant/added', payload: leaveGrant })
    if (!result.ok) return result.message
    navigate(returnTo, { replace: true })
    return null
  }

  return (
    <div>
      <SubPageHeader
        backTo={returnTo}
        description="새로 획득한 휴가를 기록합니다."
        eyebrow="내 휴가"
        title="보유 휴가 추가"
      />
      <LeaveGrantForm
        onCancel={() => navigate(returnTo)}
        onSubmit={handleSubmit}
        submitLabel="저장"
      />
    </div>
  )
}

function getSafeReturnTo(value: string | null) {
  if (!value) return '/leave'
  try {
    const url = new URL(value, 'https://airforce-calendar.local')
    if (
      url.origin === 'https://airforce-calendar.local' &&
      url.pathname === '/calendar'
    ) {
      return `${url.pathname}${url.search}`
    }
  } catch {
    // 잘못된 복귀 경로는 기본 화면으로 보낸다.
  }
  return '/leave'
}
