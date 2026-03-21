import { Badge } from '@/components/ui/Badge'

const STATUS_MAP: Record<string, { label: string; variant: 'info'|'default'|'success'|'warning'|'danger'|'muted' }> = {
  draft:           { label: 'Borrador',         variant: 'muted'   },
  options_loaded:  { label: 'Opciones cargadas',variant: 'info'    },
  sent_to_client:  { label: 'Enviada',          variant: 'warning' },
  selected:        { label: 'Opción elegida',   variant: 'success' },
  emitted:         { label: 'Emitida',          variant: 'success' },
  lost:            { label: 'Perdida',          variant: 'danger'  },
}

export function QuoteStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_MAP[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
