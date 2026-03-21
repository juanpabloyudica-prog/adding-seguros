import Link from 'next/link'
import { Shield, FolderOpen, MessageSquare, FileText } from 'lucide-react'

interface Metadata {
  policy_count:       number
  open_case_count:    number
  conversation_count: number
  document_count:     number
}

interface Props {
  personId: string
  metadata: Metadata
}

const ITEMS = [
  { key: 'policy_count',       label: 'Pólizas',        icon: Shield,       href: (id: string) => `/personas/${id}#polizas`       },
  { key: 'open_case_count',    label: 'Casos abiertos', icon: FolderOpen,   href: (id: string) => `/personas/${id}#casos`         },
  { key: 'conversation_count', label: 'Conversaciones', icon: MessageSquare,href: (id: string) => `/personas/${id}#conversaciones` },
  { key: 'document_count',     label: 'Documentos',     icon: FileText,     href: (id: string) => `/personas/${id}#documentos`    },
] as const

export function PersonMetadataBar({ personId, metadata }: Props) {
  return (
    <div className="card grid grid-cols-2 sm:grid-cols-4 divide-x divide-surface-border overflow-hidden">
      {ITEMS.map(({ key, label, icon: Icon, href }) => (
        <Link
          key={key}
          href={href(personId)}
          className="flex flex-col items-center gap-1 py-3 px-4 hover:bg-surface-subtle transition-colors text-center group"
        >
          <Icon className="w-4 h-4 text-ink-tertiary group-hover:text-brand transition-colors" />
          <p className="text-xl font-600 tabular-nums text-ink">{metadata[key]}</p>
          <p className="text-2xs text-ink-tertiary">{label}</p>
        </Link>
      ))}
    </div>
  )
}
