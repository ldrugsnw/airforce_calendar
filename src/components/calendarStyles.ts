import type { LeaveType } from '../domain/leave'

export const LEAVE_TYPE_STYLES: Record<LeaveType, string> = {
  annual: 'bg-blue-600 text-white',
  reward: 'bg-red-600 text-white',
  consolation: 'bg-amber-300 text-amber-950',
  official: 'bg-violet-600 text-white',
  petition: 'bg-slate-950 text-white',
  performance: 'bg-green-600 text-white',
  other: 'bg-slate-600 text-white',
}
