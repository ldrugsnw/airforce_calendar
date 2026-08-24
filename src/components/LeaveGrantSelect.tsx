export type LeaveGrantOption = {
  id: string
  label: string
}

type LeaveGrantSelectProps = {
  id: string
  options: LeaveGrantOption[]
  value: string
  onChange: (value: string) => void
}

export function LeaveGrantSelect({
  id,
  options,
  value,
  onChange,
}: LeaveGrantSelectProps) {
  return (
    <label
      className="block min-w-0 text-sm font-semibold text-slate-800"
      htmlFor={id}
    >
      사용할 보유 휴가
      <span className="relative mt-2 block min-w-0 w-full">
        <select
          className="h-14 min-w-0 w-full max-w-full appearance-none rounded-2xl border border-slate-300 bg-white px-4 pr-12 text-base leading-6 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          id={id}
          onChange={(event) => onChange(event.target.value)}
          value={value}
        >
          <option value="">보유 휴가를 선택하세요</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
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
      </span>
    </label>
  )
}
