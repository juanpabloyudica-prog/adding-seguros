import { Badge } from '@/components/ui/Badge'

const STATUS_MAP: Record<string, { label: string; variant: 'success'|'warning'|'danger'|'info'|'muted'|'default' }> = {
  open:            { label: 'Abierto',         variant: 'info'    },
  in_progress:     { label: 'En progreso',     variant: 'success' },
  waiting_client:  { label: 'Esp. cliente',    variant: 'warning' },
  waiting_company: { label: 'Esp. compañía',   variant: 'warning' },
  escalated:       { label: 'Escalado',        variant: 'danger'  },
  resolved:        { label: 'Resuelto',        variant: 'success' },
  closed:          { label: 'Cerrado',         variant: 'muted'   },
  cancelled:       { label: 'Cancelado',       variant: 'muted'   },
}

export function CaseStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
