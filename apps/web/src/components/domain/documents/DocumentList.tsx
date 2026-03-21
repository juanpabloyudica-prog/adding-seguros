'use client'

import { useState } from 'react'
import { FileText, ExternalLink, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { getSignedDocumentUrl } from '@/lib/api/documents'
import type { Document } from '@/lib/api/documents'
import { Badge } from '@/components/ui/Badge'

const DOC_TYPE_LABELS: Record<string, string> = {
  cotizacion:    'Cotización',
  poliza_pdf:    'Póliza PDF',
  cedula:        'Cédula verde',
  dni:           'DNI',
  informe:       'Informe',
  endoso:        'Endoso',
  recibo:        'Recibo',
  siniestro:     'Denuncia siniestro',
  otro:          'Otro'}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024)        return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-AR', {
    day: '2-digit', month: 'short', year: 'numeric'})
}

interface DocumentRowProps {
  doc: Document
}

function DocumentRow({ doc }: DocumentRowProps) {
  const [resolving, setResolving] = useState(false)

  const isStoragePath = !doc.file_url.startsWith('http')

  const handleOpen = async () => {
    if (!isStoragePath) {
      window.open(doc.file_url, '_blank', 'noopener,noreferrer')
      return
    }
    setResolving(true)
    try {
      const url = await getSignedDocumentUrl(doc.id, 3600)
      window.open(url, '_blank', 'noopener,noreferrer')
    } catch {
      // Silently fail — user sees no URL change
    } finally {
      setResolving(false)
    }
  }

  const isPdf = doc.mime_type === 'application/pdf' || doc.file_name.endsWith('.pdf')

  return (
    <div className="flex items-center gap-3 px-4 py-3 group hover:bg-surface-subtle transition-colors">
      {/* Icon */}
      <div className={clsx(
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
        isPdf ? 'bg-danger-bg' : 'bg-surface-muted'
      )}>
        <FileText className={clsx('w-4 h-4', isPdf ? 'text-danger' : 'text-ink-tertiary')} />
      </div>

      {/* Details */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-500 text-ink truncate">{doc.file_name}</p>
          <Badge variant="muted" className="text-2xs shrink-0">
            {DOC_TYPE_LABELS[doc.type] ?? doc.type}
          </Badge>
        </div>
        <div className="flex items-center gap-2 text-xs text-ink-tertiary mt-0.5">
          {doc.uploaded_by_name && <span>{doc.uploaded_by_name}</span>}
          <span>·</span>
          <span>{formatDate(doc.created_at)}</span>
          {doc.file_size && (
            <><span>·</span><span>{formatFileSize(doc.file_size)}</span></>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={handleOpen}
          disabled={resolving}
          title="Abrir"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-brand hover:bg-brand/10 transition-colors disabled:opacity-50"
        >
          {resolving
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <ExternalLink className="w-3.5 h-3.5" />
          }
          {resolving ? 'Abriendo…' : 'Abrir'}
        </button>
      </div>
    </div>
  )
}

interface DocumentListProps {
  documents:   Document[]
  loading?:    boolean
  emptyText?:  string
}

export function DocumentList({ documents, loading, emptyText }: DocumentListProps) {
  if (loading) {
    return (
      <div className="divide-y divide-surface-border">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <div className="w-8 h-8 rounded-lg bg-surface-muted animate-pulse" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-48 bg-surface-muted rounded animate-pulse" />
              <div className="h-3 w-32 bg-surface-muted rounded animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (documents.length === 0) {
    return (
      <p className="px-4 py-4 text-sm text-ink-tertiary">
        {emptyText ?? 'Sin documentos adjuntos.'}
      </p>
    )
  }

  return (
    <div className="divide-y divide-surface-border">
      {documents.map(doc => (
        <DocumentRow key={doc.id} doc={doc} />
      ))}
    </div>
  )
}
