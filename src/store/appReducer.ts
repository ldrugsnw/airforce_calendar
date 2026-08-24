import type { LeaveGrant } from '../domain/leave'
import type { LeaveUsage } from '../domain/leaveUsage'
import type { Outing } from '../domain/outing'

export type AppState = {
  leaveGrants: LeaveGrant[]
  leaveUsages: LeaveUsage[]
  outings: Outing[]
}

export type AppAction =
  | { type: 'leaveGrant/added'; payload: LeaveGrant }
  | { type: 'leaveGrant/updated'; payload: LeaveGrant }
  | { type: 'leaveGrant/deleted'; payload: { id: string } }
  | { type: 'leaveUsage/added'; payload: LeaveUsage }
  | { type: 'leaveUsage/updated'; payload: LeaveUsage }
  | { type: 'leaveUsage/canceled'; payload: { id: string; canceledAt: string } }
  | { type: 'outing/added'; payload: Outing }
  | { type: 'outing/updated'; payload: Outing }
  | { type: 'outing/canceled'; payload: { id: string; canceledAt: string } }

export const initialAppState: AppState = {
  leaveGrants: [],
  leaveUsages: [],
  outings: [],
}

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'leaveGrant/added':
      return {
        ...state,
        leaveGrants: [...state.leaveGrants, action.payload],
      }
    case 'leaveGrant/updated':
      return {
        ...state,
        leaveGrants: state.leaveGrants.map((leaveGrant) =>
          leaveGrant.id === action.payload.id ? action.payload : leaveGrant,
        ),
      }
    case 'leaveGrant/deleted':
      return {
        ...state,
        leaveGrants: state.leaveGrants.filter(
          (leaveGrant) => leaveGrant.id !== action.payload.id,
        ),
        leaveUsages: state.leaveUsages.filter(
          (leaveUsage) => leaveUsage.leaveGrantId !== action.payload.id,
        ),
      }
    case 'leaveUsage/added':
      return {
        ...state,
        leaveUsages: [...state.leaveUsages, action.payload],
      }
    case 'leaveUsage/updated':
      return {
        ...state,
        leaveUsages: state.leaveUsages.map((leaveUsage) =>
          leaveUsage.id === action.payload.id ? action.payload : leaveUsage,
        ),
      }
    case 'leaveUsage/canceled':
      return {
        ...state,
        leaveUsages: state.leaveUsages.map((leaveUsage) =>
          leaveUsage.id === action.payload.id
            ? {
                ...leaveUsage,
                canceled: true,
                canceledAt: action.payload.canceledAt,
                updatedAt: action.payload.canceledAt,
              }
            : leaveUsage,
        ),
      }
    case 'outing/added':
      return {
        ...state,
        outings: [...state.outings, action.payload],
      }
    case 'outing/updated':
      return {
        ...state,
        outings: state.outings.map((outing) =>
          outing.id === action.payload.id ? action.payload : outing,
        ),
      }
    case 'outing/canceled':
      return {
        ...state,
        outings: state.outings.map((outing) =>
          outing.id === action.payload.id
            ? {
                ...outing,
                canceled: true,
                canceledAt: action.payload.canceledAt,
                updatedAt: action.payload.canceledAt,
              }
            : outing,
        ),
      }
    default:
      return state
  }
}
