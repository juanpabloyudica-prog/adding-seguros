import type React from 'react'
import { clsx } from 'clsx'

interface SkeletonProps {
  className?: string
  rows?: number
}

export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={clsx('skeleton', className)} style={style} />
}

// Pre-built table row skeleton
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-4 border-b border-surface-border">
          <Skeleton className={clsx('h-4 rounded', i === 0 ? 'w-32' : i === cols - 1 ? 'w-16' : 'w-24')} />
        </td>
      ))}
    </tr>
  )
}

// Card skeleton
export function CardSkeleton({ rows = 3 }: SkeletonProps) {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-4 w-32 rounded" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-3 rounded" style={{ width: `${70 + (i % 3) * 10}%` }} />
      ))}
    </div>
  )
}
