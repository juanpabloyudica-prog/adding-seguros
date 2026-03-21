'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { clsx } from 'clsx'

interface PaginationProps {
  page:       number
  totalPages: number
  total:      number
  limit:      number
  onPage:     (page: number) => void
}

export function Pagination({ page, totalPages, total, limit, onPage }: PaginationProps) {
  if (totalPages <= 1) return null

  const from = (page - 1) * limit + 1
  const to   = Math.min(page * limit, total)

  return (
    <div className="flex items-center justify-between pt-3 border-t border-surface-border px-1">
      <p className="text-xs text-ink-tertiary">
        {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-1">
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className={clsx(
            'p-1.5 rounded-lg transition-colors',
            page <= 1
              ? 'text-ink-disabled cursor-not-allowed'
              : 'text-ink-secondary hover:bg-surface-muted'
          )}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-xs text-ink-secondary px-1 tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className={clsx(
            'p-1.5 rounded-lg transition-colors',
            page >= totalPages
              ? 'text-ink-disabled cursor-not-allowed'
              : 'text-ink-secondary hover:bg-surface-muted'
          )}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
