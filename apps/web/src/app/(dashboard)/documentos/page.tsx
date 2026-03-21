'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  FileText, Search, ExternalLink, Loader2,
} from 'lucide-react'
import { clsx } from 'clsx'
import { getDocuments, getSignedDocumentUrl } from '@/lib/api/documents'
import type { Document } from '@/lib/api/documents'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Skeleton } from '@/components/ui/Skeleton'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/shared/Pagination'

const ENTITY_TYPES = [
  { value: '',       label: 'Todos' },
  { value: 'policy', label: 'Pólizas' },
  { value: 'quote',  label: 'Cotizaciones' },
  { value: 'case',   label: 'Gestiones' },
  { value: 'person', label: 'Personas' },
] as const

const DOC_TYPE_LABELS: Record<string, string> = {
  cotizacion: 'Cotización', poliza_pdf: 'Póliza PDF', cedula: 'Cédula',
  dni: 'DNI', informe: 'Informe', endoso: 'Endoso', recibo: 'Recibo',
  siniestro: 'Siniestro', otro: 'Otro',
}

const ENTITY_ROUTE: Record<string, string> = {
  policy: '/polizas', quote: '/cotizaciones', case: '/gestiones', person: '/personas',
}

function formatFileSize(b: number | null): string {
  if (!b) return '—'
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-AR', { day:'2-digit', month:'short', year:'numeric' })
}
function isPdf(doc: Document) {
  return doc.mime_type === 'application/pdf' || doc.file_name.endsWith('.pdf')
}
function useDebounce<T>(value: T, ms = 350): T {
  const [d, setD] = useState(value)
  useEffect(() => { const t = setTimeout(() => setD(value), ms); return () => clearTimeout(t) }, [value, ms])
  return d
}

function OpenButton({ doc }: { doc: Document }) {
  const [loading, setLoading] = useState(false)
  const handleOpen = async () => {
    const isPath = !doc.file_url.startsWith('http')
    if (!isPath) { window.open(doc.file_url, '_blank', 'noopener,noreferrer'); return }
    setLoading(true)
    try { window.open(await getSignedDocumentUrl(doc.id), '_blank', 'noopener,noreferrer') }
    catch { /* silent */ } finally { setLoading(false) }
  }
  return (
    <button onClick={handleOpen} disabled={loading}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs text-brand hover:bg-brand/10 transition-colors disabled:opacity-50">
      {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
      Abrir
    </button>
  )
}

export default function DocumentosPage() {
  const [docs,       setDocs]       = useState<Document[]>([])
  const [total,      setTotal]      = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState<string | null>(null)
  const [search,     setSearch]     = useState('')
  const [entityType, setEntityType] = useState('')
  const [page,       setPage]       = useState(1)
  const dSearch = useDebounce(search)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await getDocuments({
        search: dSearch || undefined, entity_type: entityType || undefined, page, limit: 30,
      })
      if ('data' in res) {
        const r = res as Record<string, unknown>
        setDocs(r['data'] as Document[])
        setTotal((r['total'] as number) ?? (r['data'] as Document[]).length)
        setTotalPages((r['totalPages'] as number) ?? 1)
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Error') }
    finally { setLoading(false) }
  }, [dSearch, entityType, page])

  useEffect(() => { load() }, [load])
  useEffect(() => { setPage(1) }, [dSearch, entityType])

  return (
    <div className="space-y-4 max-w-screen-xl animate-fade-in">
      <div>
        <h1 className="text-base font-600 text-ink">Documentos</h1>
        {!loading && (
          <p className="text-xs text-ink-tertiary mt-0.5">
            {total} documento{total !== 1 ? 's' : ''} en la organización
          </p>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-tertiary pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre de archivo…"
            className="w-full h-9 pl-8 pr-3 text-sm border border-surface-border rounded-lg bg-surface focus:outline-none focus:ring-2 focus:ring-brand" />
        </div>
        <select value={entityType} onChange={e => setEntityType(e.target.value)}
          className="h-9 px-2.5 text-sm border border-surface-border rounded-lg bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand">
          {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {error && <ErrorAlert message={error} onRetry={load} />}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Archivo</th>
                <th className="hidden sm:table-cell">Tipo</th>
                <th className="hidden md:table-cell">Entidad</th>
                <th className="hidden lg:table-cell">Subido por</th>
                <th className="hidden lg:table-cell">Tamaño</th>
                <th>Fecha</th>
                <th className="w-20">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j}><Skeleton className="h-4 w-full rounded" /></td>
                      ))}
                    </tr>
                  ))
                : docs.map(doc => (
                    <tr key={doc.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <FileText className={clsx('w-4 h-4 shrink-0',
                            isPdf(doc) ? 'text-danger' : 'text-ink-tertiary')} />
                          <span className="text-sm font-500 text-ink truncate max-w-[180px]">
                            {doc.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="hidden sm:table-cell">
                        <Badge variant="muted" className="text-2xs">
                          {DOC_TYPE_LABELS[doc.type] ?? doc.type}
                        </Badge>
                      </td>
                      <td className="hidden md:table-cell">
                        {doc.entity_name && ENTITY_ROUTE[doc.entity_type] ? (
                          <Link href={`${ENTITY_ROUTE[doc.entity_type]}/${doc.entity_id}`}
                            className="text-xs text-brand hover:underline">
                            <span className="text-ink-tertiary mr-0.5">
                              {doc.entity_type === 'policy' ? 'Póliza' :
                               doc.entity_type === 'quote'  ? 'Cotiz.' :
                               doc.entity_type === 'case'   ? 'Gestión' : 'Persona'}:
                            </span>
                            {doc.entity_name}
                          </Link>
                        ) : (
                          <span className="text-xs text-ink-tertiary capitalize">{doc.entity_type}</span>
                        )}
                      </td>
                      <td className="hidden lg:table-cell text-xs text-ink-secondary">
                        {doc.uploaded_by_name ?? '—'}
                      </td>
                      <td className="hidden lg:table-cell text-xs text-ink-tertiary tabular-nums">
                        {formatFileSize(doc.file_size)}
                      </td>
                      <td className="text-xs text-ink-tertiary whitespace-nowrap">{formatDate(doc.created_at)}</td>
                      <td><OpenButton doc={doc} /></td>
                    </tr>
                  ))
              }
            </tbody>
          </table>
        </div>
        {!loading && docs.length === 0 && !error && (
          <EmptyState icon={<FileText className="w-5 h-5" />}
            title={dSearch || entityType ? 'Sin resultados' : 'Sin documentos'}
            description={
              dSearch ? `No se encontraron archivos con "${dSearch}".`
              : entityType ? 'No hay documentos en esta categoría.'
              : 'Los documentos aparecen aquí al subirlos desde pólizas, cotizaciones, gestiones o personas.'
            }
          />
        )}
        {totalPages > 1 && (
          <div className="px-4 pb-3">
            <Pagination page={page} totalPages={totalPages} total={total} limit={30} onPage={setPage} />
          </div>
        )}
      </div>
    </div>
  )
}
