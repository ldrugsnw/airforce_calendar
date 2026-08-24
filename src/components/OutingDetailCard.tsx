import { formatCalendarDate } from '../domain/calendarDate'
import type { Outing } from '../domain/outing'

type OutingDetailCardProps = {
  outing: Outing
  onEdit: () => void
  onCancel: () => void
  onClose: () => void
}

export function OutingDetailCard({
  outing,
  onEdit,
  onCancel,
  onClose,
}: OutingDetailCardProps) {
  return (
    <div className="mt-3 rounded-2xl border border-orange-200 bg-white p-4 shadow-sm">
      <span className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">
        <span className="size-2 rounded-full bg-orange-500" />
        외출
      </span>
      <p className="mt-3 font-semibold text-slate-950">{outing.reason}</p>
      <p className="mt-2 text-sm text-slate-600">
        {formatCalendarDate(outing.date)}
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="min-h-11 rounded-xl bg-orange-500 px-4 text-sm font-semibold text-white"
          onClick={onEdit}
          type="button"
        >
          외출 수정
        </button>
        <button
          className="min-h-11 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700"
          onClick={onCancel}
          type="button"
        >
          외출 취소
        </button>
      </div>
      <button
        className="mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
        onClick={onClose}
        type="button"
      >
        상세 닫기
      </button>
    </div>
  )
}
