import { useState, type FormEvent, type ReactNode } from 'react'
import { LEAVE_TYPES, type LeaveType } from '../domain/leave'

export type LeaveGrantFormValues = {
  type: LeaveType
  days: number
  acquiredDate: string
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
  acquiredDate: '',
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
  const [isDirty, setIsDirty] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const values = initialValues ?? emptyValues

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formData = new FormData(event.currentTarget)
    const type = formData.get('type')?.toString() ?? ''
    const daysValue = formData.get('days')?.toString() ?? ''
    const acquiredDate = formData.get('acquiredDate')?.toString() ?? ''
    const days = Number(daysValue)
    const nextErrors: FormErrors = {}

    if (!LEAVE_TYPES.some((leaveType) => leaveType.value === type)) {
      nextErrors.type = '휴가 종류를 선택해주세요.'
    }

    if (!Number.isInteger(days) || days < 1) {
      nextErrors.days = '획득 일수는 1일 이상의 정수로 입력해주세요.'
    }

    if (!acquiredDate) {
      nextErrors.acquiredDate = '획득 날짜를 선택해주세요.'
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    const submittedValues = {
      type: type as LeaveType,
      days,
      acquiredDate,
      reason: formData.get('reason')?.toString().trim() ?? '',
      memo: formData.get('memo')?.toString().trim() ?? '',
    }
    const validationMessage = validate?.(submittedValues) ?? null

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
      <Field label="휴가 종류" required error={errors.type}>
        <div className="relative min-w-0 w-full">
          <select
            aria-invalid={Boolean(errors.type)}
            className={`${inputClassName(Boolean(errors.type))} appearance-none pr-12`}
            defaultValue={values.type}
            name="type"
          >
            <option disabled value="">
              휴가 종류 선택
            </option>
            {LEAVE_TYPES.map((leaveType) => (
              <option key={leaveType.value} value={leaveType.value}>
                {leaveType.label}
              </option>
            ))}
          </select>
          <SelectChevron />
        </div>
      </Field>

      <Field label="획득 일수" required error={errors.days}>
        <div className="relative">
          <input
            aria-invalid={Boolean(errors.days)}
            className={`${inputClassName(Boolean(errors.days))} pr-12`}
            defaultValue={values.days}
            inputMode="numeric"
            min="1"
            name="days"
            placeholder="예: 3"
            step="1"
            type="number"
          />
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-sm text-slate-500">
            일
          </span>
        </div>
      </Field>

      <Field label="획득 날짜" required error={errors.acquiredDate}>
        <input
          aria-invalid={Boolean(errors.acquiredDate)}
          className={`${inputClassName(Boolean(errors.acquiredDate))} calendar-date-input calendar-date-input-centered`}
          defaultValue={values.acquiredDate}
          name="acquiredDate"
          type="date"
        />
      </Field>

      <Field label="획득 사유" hint="선택">
        <input
          className={inputClassName(false)}
          defaultValue={values.reason}
          name="reason"
          placeholder="예: 주 40시간 근무"
          type="text"
        />
      </Field>

      <Field label="메모" hint="선택">
        <textarea
          className={`${inputClassName(false)} min-h-28 resize-y py-3`}
          defaultValue={values.memo}
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

function SelectChevron() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 text-slate-500"
      fill="none"
      viewBox="0 0 20 20"
    >
      <path
        d="m6 8 4 4 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.75"
      />
    </svg>
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
