'use client'

import { useState, useRef, useCallback } from 'react'
import { Upload, X, FileText, AlertCircle, CheckCircle2 } from 'lucide-react'
import { clsx } from 'clsx'
import { uploadDocument, StorageError } from '@/lib/storage/documents'
import { Button } from '@/components/ui/Button'
import type { Document } from '@/lib/api/documents'

const DOC_TYPE_LABELS: Record<string, string> = {
  cotizacion:    'Cotización',
  poliza_pdf:    'Póliza PDF',
  cedula:        'Cédula verde',
  dni:           'DNI',
  informe:       'Informe',
  endoso:        'Endoso',
  recibo:        'Recibo',
  siniestro:     'Denuncia siniestro',
  otro:          'Otro',
}

export type EntityType = 'policy' | 'case' | 'quote' | 'person'

interface DocumentUploaderProps {
  orgId:        string
  entityType:   EntityType
  entityId:     string
  defaultDocType?: string
  allowedTypes?:   string[]    // MIME types, e.g. ['application/pdf']
  onUploaded:   (doc: Document) => void
  onCancel?:    () => void
  compact?:     boolean        // minimal mode without drag zone
}

type UploadState =
  | { status: 'idle' }
  | { status: 'selected'; file: File }
  | { status: 'uploading'; file: File; progress: number }
  | { status: 'done'; doc: Document }
  | { status: 'error'; message: string }

export function DocumentUploader({
  orgId, entityType, entityId, defaultDocType = 'otro',
  allowedTypes, onUploaded, onCancel, compact = false,
}: DocumentUploaderProps) {
  const [state,   setState]   = useState<UploadState>({ status: 'idle' })
  const [docType, setDocType] = useState(defaultDocType)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    if (allowedTypes && !allowedTypes.includes(file.type)) {
      setState({ status: 'error', message: `Tipo no permitido: ${file.type}` })
      return
    }
    setState({ status: 'selected', file })
  }, [allowedTypes])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [handleFile])

  const handleUpload = useCallback(async () => {
    if (state.status !== 'selected') return
    const { file } = state

    setState({ status: 'uploading', file, progress: 0 })

    try {
      const result = await uploadDocument({
        orgId, entityType, entityId, docType, file,
        onProgress: (pct) => setState({ status: 'uploading', file, progress: pct }),
      })

      setState({ status: 'done', doc: result.document })
      onUploaded(result.document)
    } catch (err) {
      const msg = err instanceof StorageError
        ? err.message
        : err instanceof Error ? err.message : 'Error al subir archivo'
      setState({ status: 'error', message: msg })
    }
  }, [state, orgId, entityType, entityId, docType, onUploaded])

  const reset = () => {
    setState({ status: 'idle' })
    if (inputRef.current) inputRef.current.value = ''
  }

  // ── Done state ──────────────────────────────────────────────────────────────
  if (state.status === 'done') {
    return (
      <div className="flex items-center gap-3 p-3 bg-success-bg border border-success/20 rounded-lg">
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-500 text-ink truncate">{state.doc.file_name}</p>
          <p className="text-xs text-success">Subido exitosamente</p>
        </div>
        <Button variant="ghost" size="xs" onClick={reset}>Subir otro</Button>
      </div>
    )
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (state.status === 'error') {
    return (
      <div className="flex items-center gap-3 p-3 bg-danger-bg border border-danger/20 rounded-lg">
        <AlertCircle className="w-4 h-4 text-danger shrink-0" />
        <p className="text-sm text-danger flex-1">{state.message}</p>
        <Button variant="ghost" size="xs" onClick={reset}>Reintentar</Button>
      </div>
    )
  }

  // ── Upload in progress ──────────────────────────────────────────────────────
  if (state.status === 'uploading') {
    return (
      <div className="space-y-2 p-3 border border-surface-border rounded-lg">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-brand shrink-0" />
          <p className="text-sm text-ink truncate flex-1">{state.file.name}</p>
          <span className="text-xs text-brand font-mono">{state.progress}%</span>
        </div>
        <div className="w-full bg-surface-muted rounded-full h-1.5">
          <div
            className="bg-brand h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${state.progress}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Doc type selector */}
      <div className="flex items-center gap-2">
        <label className="text-xs font-500 text-ink-secondary shrink-0">Tipo</label>
        <select
          value={docType}
          onChange={e => setDocType(e.target.value)}
          className="h-8 px-2 text-xs border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand flex-1"
        >
          {Object.entries(DOC_TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* File selection */}
      {state.status === 'idle' ? (
        compact ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <Button variant="secondary" size="sm" icon={<Upload className="w-3.5 h-3.5" />}
              onClick={() => inputRef.current?.click()} type="button">
              Seleccionar archivo
            </Button>
            <input ref={inputRef} type="file" className="hidden"
              accept={allowedTypes?.join(',') ?? '*'}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </label>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => inputRef.current?.click()}
            className={clsx(
              'border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors',
              dragOver
                ? 'border-brand bg-brand/5'
                : 'border-surface-border hover:border-brand/50 hover:bg-surface-subtle'
            )}
          >
            <Upload className={clsx('w-5 h-5 mx-auto mb-2', dragOver ? 'text-brand' : 'text-ink-tertiary')} />
            <p className="text-sm text-ink-secondary">
              Arrastrá un archivo o <span className="text-brand font-500">hacé click</span>
            </p>
            <p className="text-xs text-ink-tertiary mt-0.5">
              PDF, imagen, Word — máximo 50 MB
            </p>
            <input ref={inputRef} type="file" className="hidden"
              accept={allowedTypes?.join(',') ?? '*'}
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        )
      ) : (
        /* File selected — confirm before upload */
        <div className="flex items-center gap-3 p-3 bg-surface-subtle border border-surface-border rounded-lg">
          <FileText className="w-4 h-4 text-brand shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-500 text-ink truncate">{state.file.name}</p>
            <p className="text-xs text-ink-tertiary">
              {(state.file.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <div className="flex gap-1.5 shrink-0">
            <Button variant="primary" size="xs" onClick={handleUpload}>Subir</Button>
            <button onClick={reset} className="p-1 text-ink-tertiary hover:text-ink">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {onCancel && (
        <button onClick={onCancel} className="text-xs text-ink-tertiary hover:text-ink">
          Cancelar
        </button>
      )}
    </div>
  )
}
