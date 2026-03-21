import { Badge } from '@/components/ui/Badge'

const STATUS_CONFIG: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'info' | 'muted' | 'default' }> = {
  open:               { label: 'Abierta',           variant: 'success'  },
  waiting_operativo:  { label: 'Esp. operativo',    variant: 'warning'  },
  waiting_productor:  { label: 'Esp. productor',    variant: 'warning'  },
  escalated:          { label: 'Escalada',          variant: 'danger'   },
  resolved:           { label: 'Resuelta',          variant: 'info'     },
  closed:             { label: 'Cerrada',           variant: 'muted'    },
}

export function ConversationStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: 'default' as const }
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>
}
