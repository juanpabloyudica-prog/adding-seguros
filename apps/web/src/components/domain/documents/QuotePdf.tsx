'use client'

/**
 * Quote PDF generation using @react-pdf/renderer.
 *
 * FLOW:
 *   1. User clicks "Generar propuesta PDF"
 *   2. Component renders the PDF in-browser using react-pdf
 *   3. The PDF Blob is uploaded to Supabase Storage via uploadDocument()
 *   4. Metadata is registered in the documents table
 *   5. A signed URL is generated and opened in a new tab
 *
 * This is entirely client-side — no server-side PDF generation needed.
 * @react-pdf/renderer works in Next.js client components with dynamic import.
 */

import { useState, useCallback } from 'react'
import { FileText, Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { uploadDocument } from '@/lib/storage/documents'
import type { QuotePdfData, Document } from '@/lib/api/documents'

interface GeneratePdfButtonProps {
  quoteId:     string
  orgId:       string
  pdfData:     QuotePdfData
  onGenerated: (doc: Document, signedUrl: string) => void
}

type GenerateState = 'idle' | 'generating' | 'uploading' | 'done' | 'error'

/** Formats currency amounts */
function fmtCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('es-AR', { minimumFractionDigits: 0 })}`
}

/**
 * Builds the PDF HTML string that will be converted via print/blob.
 * We use a printable HTML approach since @react-pdf/renderer requires
 * dynamic import and adds ~300KB. This gives us full control.
 */
function buildPdfHtml(data: QuotePdfData): string {
  const { quote, options_for_client, selected_option } = data
  const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })

  const optionsHtml = options_for_client.map(opt => `
    <div class="option ${opt.is_selected ? 'selected' : ''}">
      <div class="option-header">
        <div>
          <div class="option-company">${opt.company_name ?? '—'}</div>
          <div class="option-plan">${opt.plan_name}</div>
        </div>
        <div class="option-premium">${fmtCurrency(opt.premium, opt.currency)}<span class="option-period">/mes</span></div>
      </div>
      ${Object.keys(opt.coverage ?? {}).length > 0 ? `
        <div class="option-coverages">
          <div class="coverage-title">Coberturas incluidas</div>
          <ul class="coverage-list">
            ${Object.entries(opt.coverage).map(([k, v]) =>
              `<li><strong>${k.replace(/_/g, ' ')}</strong>${v !== null && v !== true ? `: ${v}` : ''}</li>`
            ).join('')}
          </ul>
        </div>` : ''}
      ${opt.is_selected ? '<div class="badge-selected">✓ Opción elegida</div>' : ''}
    </div>
  `).join('')

  const riskParts = [
    quote.risk_type ? quote.risk_type.charAt(0).toUpperCase() + quote.risk_type.slice(1) : null,
    quote.risk_data?.['marca'] && quote.risk_data?.['modelo']
      ? `${quote.risk_data['marca']} ${quote.risk_data['modelo']}` : null,
    quote.risk_data?.['anio'] ? String(quote.risk_data['anio']) : null,
    quote.risk_data?.['patente'] ? String(quote.risk_data['patente']) : null,
  ].filter(Boolean).join(' · ')

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Propuesta Comercial</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, Arial, sans-serif; font-size: 13px; color: #1a1a1a; line-height: 1.5; }
  .page { max-width: 760px; margin: 0 auto; padding: 40px 48px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 24px; border-bottom: 2px solid #1B4FD8; }
  .org-name { font-size: 20px; font-weight: 700; color: #1B4FD8; }
  .producer { font-size: 13px; color: #555; margin-top: 4px; }
  .ref { text-align: right; font-size: 11px; color: #888; }
  .ref-code { font-family: monospace; font-size: 13px; color: #333; margin-bottom: 4px; }
  .section { margin-bottom: 28px; }
  .section-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; font-weight: 600; margin-bottom: 12px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .info-label { font-size: 11px; color: #888; }
  .info-value { font-size: 13px; font-weight: 500; color: #111; margin-top: 2px; }
  .option { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
  .option.selected { border-color: #1B4FD8; background: #f0f5ff; }
  .option-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; }
  .option-company { font-size: 14px; font-weight: 700; color: #111; }
  .option-plan { font-size: 12px; color: #666; margin-top: 2px; }
  .option-premium { font-size: 22px; font-weight: 700; color: #1B4FD8; }
  .option-period { font-size: 12px; font-weight: 400; color: #888; }
  .option-coverages { border-top: 1px solid #e5e7eb; padding-top: 10px; }
  .coverage-title { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin-bottom: 6px; }
  .coverage-list { list-style: none; display: grid; grid-template-columns: 1fr 1fr; gap: 4px; }
  .coverage-list li { font-size: 11px; color: #444; display: flex; align-items: center; gap: 4px; }
  .coverage-list li::before { content: '·'; color: #1B4FD8; font-weight: bold; }
  .badge-selected { display: inline-block; margin-top: 10px; background: #1B4FD8; color: white; font-size: 11px; font-weight: 600; padding: 3px 10px; border-radius: 999px; }
  .footer { border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 32px; display: flex; justify-content: space-between; font-size: 11px; color: #888; }
  .recommendation { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px; margin-bottom: 28px; }
  .rec-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #16a34a; font-weight: 600; margin-bottom: 6px; }
  .rec-text { font-size: 13px; color: #166534; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="org-name">${quote.org_name ?? 'ADDING Seguros'}</div>
      ${quote.producer_name ? `<div class="producer">${quote.producer_name}</div>` : ''}
    </div>
    <div class="ref">
      <div class="ref-code">${quote.id.slice(0, 8).toUpperCase()}</div>
      <div>Fecha: ${today}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Datos del asegurado</div>
    <div class="info-grid">
      <div>
        <div class="info-label">Nombre</div>
        <div class="info-value">${quote.person_name ?? '—'}</div>
      </div>
      ${quote.person_doc_type ? `<div>
        <div class="info-label">${quote.person_doc_type}</div>
        <div class="info-value">${quote.person_doc_number ?? '—'}</div>
      </div>` : ''}
      ${riskParts ? `<div>
        <div class="info-label">Riesgo</div>
        <div class="info-value">${riskParts}</div>
      </div>` : ''}
      ${quote.person_phone ? `<div>
        <div class="info-label">Teléfono</div>
        <div class="info-value">${quote.person_phone}</div>
      </div>` : ''}
    </div>
  </div>

  ${options_for_client.length > 0 ? `
  <div class="section">
    <div class="section-title">Opciones de cobertura</div>
    ${optionsHtml}
  </div>` : ''}

  ${selected_option ? `
  <div class="recommendation">
    <div class="rec-label">Opción seleccionada</div>
    <div class="rec-text">${selected_option.company_name} · ${selected_option.plan_name} — ${fmtCurrency(selected_option.premium, selected_option.currency)}/mes</div>
    ${quote.selection_reason ? `<div class="rec-text" style="margin-top:6px;font-size:12px">Motivo: ${quote.selection_reason}</div>` : ''}
  </div>` : ''}

  <div class="footer">
    <div>${quote.org_name ?? 'ADDING Seguros'} · ${quote.producer_name ?? ''}</div>
    <div>Propuesta válida por 15 días · ${today}</div>
  </div>
</div>
</body>
</html>`
}

/**
 * Converts an HTML string to a PDF Blob using the browser's print API.
 * Opens an invisible iframe, prints to PDF as a blob.
 */
async function htmlToPdfBlob(html: string, fileName: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe')
    iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:none;opacity:0'
    document.body.appendChild(iframe)

    const doc = iframe.contentDocument!
    doc.open(); doc.write(html); doc.close()

    // Small delay to let styles render
    setTimeout(() => {
      try {
        // Use print-to-PDF via the browser
        // We capture it as a blob via a blob URL approach
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
        document.body.removeChild(iframe)
        // NOTE: True headless PDF requires server-side (puppeteer/wkhtmltopdf).
        // In the browser we produce a print-ready HTML blob. The user can
        // Save as PDF from the print dialog, OR we upload the HTML with .html extension
        // and treat it as the "PDF" source of truth. The signed URL opens it as printable.
        resolve(blob)
      } catch (err) {
        document.body.removeChild(iframe)
        reject(err)
      }
    }, 500)
  })
}

/**
 * Generates a PRINTABLE HTML PROPOSAL — not a binary PDF.
 * The output is a styled HTML file stored in Supabase Storage.
 * When opened in a browser, the user can File > Print > Save as PDF.
 * Native PDF generation (Puppeteer/wkhtmltopdf) is planned for a future phase.
 */
export function GeneratePdfButton({
  quoteId, orgId, pdfData, onGenerated,
}: GeneratePdfButtonProps) {
  const [genState, setGenState] = useState<GenerateState>('idle')
  const [error,    setError]    = useState<string | null>(null)

  const handleGenerate = useCallback(async () => {
    setGenState('generating'); setError(null)

    try {
      // 1. Build HTML
      const html = buildPdfHtml(pdfData)
      setGenState('uploading')

      // 2. Create blob — printable HTML (opens as PDF when printed/saved)
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const personName = pdfData.quote.person_name?.replace(/\s+/g, '_').toLowerCase() ?? 'cliente'
      const dateStr    = new Date().toISOString().split('T')[0]
      const fileName   = `propuesta_${personName}_${dateStr}.html`
      const file       = new File([blob], fileName, { type: 'text/html' })

      // 3. Upload to Supabase Storage + register in documents table
      const result = await uploadDocument({
        orgId,
        entityType: 'quote',
        entityId:   quoteId,
        docType:    'cotizacion',
        file,
      })

      setGenState('done')
      onGenerated(result.document, result.signedUrl)

      // 4. Open immediately in new tab (print-ready)
      window.open(result.signedUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al generar propuesta')
      setGenState('error')
    }
  }, [quoteId, orgId, pdfData, onGenerated])

  const reset = () => { setGenState('idle'); setError(null) }

  if (genState === 'done') {
    return (
      <div className="flex items-center gap-2 text-sm text-success">
        <CheckCircle2 className="w-4 h-4 shrink-0" />
        Propuesta generada y guardada
        <button onClick={reset} className="text-xs text-ink-tertiary hover:text-ink ml-2">
          Generar otra
        </button>
      </div>
    )
  }

  if (genState === 'error') {
    return (
      <div className="space-y-2">
        <p className="text-sm text-danger">{error}</p>
        <Button variant="secondary" size="sm" onClick={reset}>Reintentar</Button>
      </div>
    )
  }

  return (
    <Button
      variant="primary"
      size="sm"
      loading={genState === 'generating' || genState === 'uploading'}
      onClick={handleGenerate}
      icon={genState === 'idle' ? <FileText className="w-3.5 h-3.5" /> : <Loader2 className="w-3.5 h-3.5 animate-spin" />}
    >
      {genState === 'idle'       ? 'Generar propuesta (HTML imprimible)' :
       genState === 'generating' ? 'Generando…' :
       genState === 'uploading'  ? 'Guardando…' : 'Propuesta lista'}
    </Button>
  )
}
