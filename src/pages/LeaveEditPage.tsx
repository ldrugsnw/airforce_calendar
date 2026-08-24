import { Navigate, useNavigate, useParams } from 'react-router'
import {
  LeaveGrantForm,
  type LeaveGrantFormValues,
} from '../components/LeaveGrantForm'
import { SubPageHeader } from '../components/SubPageHeader'
import { getUsedDaysForGrant } from '../domain/leaveUsage'
import { useAppDispatch, useAppState } from '../store/appStateContext'

export function LeaveEditPage() {
  const { leaveGrantId } = useParams()
  const { leaveGrants, leaveUsages } = useAppState()
  const dispatch = useAppDispatch()
  const navigate = useNavigate()
  const leaveGrant = leaveGrants.find((item) => item.id === leaveGrantId)

  if (!leaveGrant) {
    return <Navigate to="/leave" replace />
  }

  const currentLeaveGrant = leaveGrant

  async function handleSubmit(values: LeaveGrantFormValues) {
    const result = await dispatch({
      type: 'leaveGrant/updated',
      payload: {
        ...currentLeaveGrant,
        ...values,
        updatedAt: new Date().toISOString(),
      },
    })
    if (!result.ok) return result.message
    navigate(`/leave/${currentLeaveGrant.id}`, { replace: true })
    return null
  }

  return (
    <div>
      <SubPageHeader
        backTo={`/leave/${currentLeaveGrant.id}`}
        description="저장하면 보유 휴가 정보가 즉시 갱신됩니다."
        eyebrow="내 휴가"
        title="보유 휴가 수정"
      />
      <LeaveGrantForm
        initialValues={{
          type: currentLeaveGrant.type,
          days: currentLeaveGrant.days,
          acquiredDate: currentLeaveGrant.acquiredDate,
          reason: currentLeaveGrant.reason,
          memo: currentLeaveGrant.memo,
        }}
        onCancel={() => navigate(`/leave/${currentLeaveGrant.id}`)}
        onSubmit={handleSubmit}
        submitLabel="변경사항 저장"
        validate={(values) => {
          const usedDays = getUsedDaysForGrant(currentLeaveGrant.id, leaveUsages)
          return values.days < usedDays
            ? `이미 ${usedDays}일의 사용 일정이 연결되어 있어 획득 일수를 ${usedDays}일보다 작게 변경할 수 없습니다.`
            : null
        }}
      />
    </div>
  )
}
