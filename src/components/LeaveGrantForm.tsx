import { useState, type FormEvent, type ReactNode } from 'react'
import {
  LEAVE_TYPES,
  MAX_LEAVE_GRANT_DAYS,
  MAX_LEAVE_MEMO_LENGTH,
  MAX_LEAVE_REASON_LENGTH,
  MIN_LEAVE_GRANT_DAYS,
  validateLeaveGrantInput,
  type LeaveType,
} from '../domain/leave'
import {
  MAX_CALENDAR_DATE,
  MIN_CALENDAR_DATE,
  type CalendarDate,
} from '../domain/calendarDate'
import { LEAVE_TYPE_STYLES } from './calendarStyles'

export type LeaveGrantFormValues = {
  type: LeaveType
  days: number
  acquiredDate: CalendarDate | null
  reason: string
  memo: string
}

type LeaveGrantFormProps = {
  initialValues?: LeaveGrantFormValues
  onCancel: () => void
  onSubmit: (values: LeaveGrantFormValues) => void | Promise<string | null>
  submitLabel: string
  validate?: (values: LeaveGrantFormValues) => string | null
}

type FormErrors = Partial<Record<'type' | 'days' | 'acquiredDate', string>>

const emptyValues = {
  type: '',
  days: '',
  acquiredDate: null,
  reason: '',
  memo: '',
}

export function LeaveGrantForm({
  initialValues,
  onCancel,
  onSubmit,
  submitLabel,
  validate,
}: LeaveGrantFormProps) {
  const [errors, setErrors] = useState<FormErrors>({})
  const [selectedType, setSelectedType] = useState<LeaveType | ''>(
    initialValues?.type ?? '',
  )
  const [daysValue, setDaysValue] = useState(
    initialValues ? String(initialValues.days) : '',
  )
  const [isDirty, setIsDirty] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const values = initialValues ?? emptyValues

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const type = selectedType
    const acquiredDateValue = formData.get('acquiredDate')?.toString() ?? ''
    const acquiredDate = acquiredDateValue
      ? (acquiredDateValue as CalendarDate)
      : null
    const days = Number(daysValue)
    const nextErrors: FormErrors = {}

    if (!LEAVE_TYPES.some((leaveType) => leaveType.value === type)) {
      nextErrors.type = '휴가 종류를 선택해주세요.'
    }

    if (
      !Number.isInteger(days) ||
      days < MIN_LEAVE_GRANT_DAYS ||
      days > MAX_LEAVE_GRANT_DAYS
    ) {
      nextErrors.days = `획득 일수는 ${MIN_LEAVE_GRANT_DAYS}~${MAX_LEAVE_GRANT_DAYS}일 정수로 입력해주세요.`
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const submittedValues: LeaveGrantFormValues = {
      type: type as LeaveType,
      days,
      acquiredDate,
      reason: formData.get('reason')?.toString().trim() ?? '',
      memo: formData.get('memo')?.toString().trim() ?? '',
    }
    const validationMessage =
      validateLeaveGrantInput(submittedValues) ?? validate?.(submittedValues) ?? null

    if (validationMessage) {
      setSubmitError(validationMessage)
      return
    }

    const serverMessage = await onSubmit(submittedValues)
    if (serverMessage) setSubmitError(serverMessage)
  }

  function handleCancel() {
    if (
      isDirty &&
      !window.confirm('작성한 내용을 저장하지 않고 나갈까요?')
    ) {
      return
    }

    onCancel()
  }

  function changeDaysBy(delta: number) {
    setDaysValue((current) => {
      const fallback = delta > 0 ? 0 : MIN_LEAVE_GRANT_DAYS
      return String(
        Math.min(
          MAX_LEAVE_GRANT_DAYS,
          Math.max(MIN_LEAVE_GRANT_DAYS, (Number(current) || fallback) + delta),
        ),
      )
    })
    setErrors((current) => ({ ...current, days: undefined }))
    setIsDirty(true)
    setSubmitError(null)
  }

  return (
    <form
      className="mt-8 space-y-6"
      noValidate
      onChange={() => {
        setIsDirty(true)
        setSubmitError(null)
      }}
      onSubmit={handleSubmit}
    >
      <fieldset>
        <legend className="text-sm font-semibold text-slate-800">
          휴가 종류 <span className="text-red-500">*</span>
        </legend>
        <div
          aria-invalid={Boolean(errors.type)}
          aria-label="휴가 종류"
          className="mt-2 grid grid-cols-2 gap-2"
          role="radiogroup"
        >
          {LEAVE_TYPES.map((leaveType) => (
            <label
              className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-semibold transition ${
                selectedType === leaveType.value
                  ? `border-transparent ring-2 ring-slate-300 ring-offset-1 ${LEAVE_TYPE_STYLES[leaveType.value]}`
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
              key={leaveType.value}
            >
              <input
                checked={selectedType === leaveType.value}
                className="sr-only"
                name="type"
                onChange={() => {
                  setSelectedType(leaveType.value)
                  setErrors((current) => ({ ...current, type: undefined }))
                }}
                type="radio"
                value={leaveType.value}
              />
              {leaveType.label}
            </label>
          ))}
        </div>
        {errors.type && (
          <p className="mt-2 text-sm text-red-600" role="alert">
            {errors.type}
          </p>
        )}
      </fieldset>

      <Field label="획득 일수" required error={errors.days}>
        <div className="grid grid-cols-[3.5rem_1fr_3.5rem] gap-2">
          <button
            aria-label="획득 일수 1일 줄이기"
            className="rounded-xl border border-slate-300 bg-white text-xl font-bold text-slate-700"
            onClick={() => changeDaysBy(-1)}
            type="button"
          >
            −
          </button>
          <div className="relative">
            <input
              aria-invalid={Boolean(errors.days)}
              className={`${inputClassName(Boolean(errors.days))} pr-12`}
              max={MAX_LEAVE_GRANT_DAYS}
              inputMode="numeric"
              min={MIN_LEAVE_GRANT_DAYS}
              name="days"
              onChange={(event) => setDaysValue(event.target.value)}
              placeholder="예: 3"
              step="1"
              type="number"
              value={daysValue}
            />
            <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-500">
              일
            </span>
          </div>
          <button
            aria-label="획득 일수 1일 늘리기"
            className="rounded-xl border border-slate-300 bg-white text-xl font-bold text-slate-700"
            onClick={() => changeDaysBy(1)}
            type="button"
          >
            +
          </button>
        </div>
      </Field>

      <Field label="획득 날짜" hint="선택" error={errors.acquiredDate}>
        <input
          aria-invalid={Boolean(errors.acquiredDate)}
          className={`${inputClassName(Boolean(errors.acquiredDate))} calendar-date-input calendar-date-input-centered`}
          defaultValue={values.acquiredDate ?? ''}
          max={MAX_CALENDAR_DATE}
          min={MIN_CALENDAR_DATE}
          name="acquiredDate"
          type="date"
        />
      </Field>

      <Field label="획득 사유" hint="선택">
        <input
          className={inputClassName(false)}
          defaultValue={values.reason}
          maxLength={MAX_LEAVE_REASON_LENGTH}
          name="reason"
          placeholder="예: 주 40시간 근무"
          type="text"
        />
      </Field>

      <Field label="메모" hint="선택">
        <textarea
          className={`${inputClassName(false)} min-h-28 resize-y py-3`}
          defaultValue={values.memo}
          maxLength={MAX_LEAVE_MEMO_LENGTH}
          name="memo"
          placeholder="추가로 기억할 내용을 입력하세요."
        />
      </Field>

      {submitError && (
        <p
          className="rounded-xl bg-red-50 p-3 text-sm font-medium leading-6 text-red-700"
          role="alert"
        >
          {submitError}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 pt-2">
        <button
          className="min-h-12 rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          onClick={handleCancel}
          type="button"
        >
          취소
        </button>
        <button
          className="min-h-12 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          type="submit"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )
}

type FieldProps = {
  children: ReactNode
  error?: string
  hint?: string
  label: string
  required?: boolean
}

function Field({ children, error, hint, label, required }: FieldProps) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-sm font-semibold text-slate-800">
        {label}
        {required && <span className="text-red-500">*</span>}
        {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
      </span>
      <span className="mt-2 block">{children}</span>
      {error && (
        <span className="mt-2 block text-sm text-red-600" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}

function inputClassName(hasError: boolean) {
  return `h-14 min-w-0 w-full max-w-full rounded-xl border bg-white px-4 text-base leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:ring-3 ${
    hasError
      ? 'border-red-400 focus:border-red-500 focus:ring-red-100'
      : 'border-slate-300 focus:border-brand-500 focus:ring-brand-100'
  }`
}
