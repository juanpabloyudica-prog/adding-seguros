import { clsx } from 'clsx'

interface Field {
  label: string
  value: React.ReactNode
  mono?:  boolean
}

interface PersonInfoGridProps {
  fields: Field[]
  cols?: 2 | 3
}

export function PersonInfoGrid({ fields, cols = 2 }: PersonInfoGridProps) {
  return (
    <dl className={clsx(
      'grid gap-x-6 gap-y-4',
      cols === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
    )}>
      {fields.map(({ label, value, mono }) => (
        <div key={label} className="flex flex-col gap-0.5">
          <dt className="text-2xs font-500 text-ink-tertiary uppercase tracking-wide">{label}</dt>
          <dd className={clsx(
            'text-sm text-ink',
            mono && 'font-mono',
            !value && 'text-ink-tertiary'
          )}>
            {value ?? '—'}
          </dd>
        </div>
      ))}
    </dl>
  )
}
