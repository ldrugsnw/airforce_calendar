export type CalendarLegendItem = {
  id: string
  label: string
  colorClassName: string
}

type CalendarLegendProps = {
  items: CalendarLegendItem[]
  hasOuting: boolean
}

export function CalendarLegend({ items, hasOuting }: CalendarLegendProps) {
  if (items.length === 0 && !hasOuting) return null

  return (
    <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
      {items.map((item) => (
        <span
          className="inline-flex max-w-full items-start gap-1.5 text-xs text-slate-600"
          key={item.id}
        >
          <span
            className={`mt-0.5 size-3 shrink-0 rounded-full ${item.colorClassName}`}
          />
          <span className="min-w-0 break-words">{item.label}</span>
        </span>
      ))}
      {hasOuting && (
        <span className="inline-flex max-w-full items-start gap-1.5 text-xs text-slate-600">
          <span className="mt-0.5 size-3 shrink-0 rounded-full bg-orange-500" />
          <span className="min-w-0 break-words">외출</span>
        </span>
      )}
    </div>
  )
}
