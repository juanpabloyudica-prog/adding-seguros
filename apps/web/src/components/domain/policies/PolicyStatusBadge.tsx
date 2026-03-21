import { Badge } from '@/components/ui/Badge'

const STATUS_MAP: Record<string, { label: string; variant: 'success'|'warning'|'danger'|'muted'|'info'|'default' }> = {
  draft:     { label: 'Borrador',   variant: 'muted'   },
  active:    { label: 'Vigente',    variant: 'success' },
  expiring:  { label: 'Por vencer', variant: 'warning' },
  expired:   { label: 'Vencida',    variant: 'danger'  },
  cancelled: { label: 'Cancelada',  variant: 'muted'   },
}

export function PolicyStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
