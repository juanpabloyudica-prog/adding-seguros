'use client'

import { clsx } from 'clsx'
import { Check, ChevronRight } from 'lucide-react'
import type { CaseWorkflowStep } from '@/lib/api/cases'

interface CaseWorkflowStepperProps {
  steps:          CaseWorkflowStep[]
  currentStepKey: string | null
  onAdvance:      (stepKey: string) => Promise<unknown>
  acting:         boolean
  caseStatus:     string
}

export function CaseWorkflowStepper({
  steps, currentStepKey, onAdvance, acting, caseStatus,
}: CaseWorkflowStepperProps) {
  if (!steps.length) return null

  const isClosed   = caseStatus === 'closed' || caseStatus === 'cancelled'
  const currentIdx = steps.findIndex(s => s.key === currentStepKey)

  // Steps that can be advanced to from the current step
  const currentStep   = steps[currentIdx]
  const allowedNext   = new Set(currentStep?.allowed_transitions ?? [])

  return (
    <div className="space-y-3">
      {/* Step list */}
      <div className="space-y-1">
        {steps.map((step, idx) => {
          const isPast    = currentIdx >= 0 && idx < currentIdx
          const isCurrent = step.key === currentStepKey
          const isNext    = !isClosed && allowedNext.has(step.key)
          const isFuture  = !isPast && !isCurrent

          return (
            <div
              key={step.key}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                isCurrent  && 'bg-brand/10 border border-brand/20',
                isNext     && !isCurrent && 'hover:bg-surface-muted cursor-pointer',
                isPast     && 'opacity-60',
                isFuture && !isNext && 'opacity-40',
              )}
              onClick={isNext && !isCurrent ? () => onAdvance(step.key) : undefined}
            >
              {/* Step indicator */}
              <div className={clsx(
                'w-6 h-6 rounded-full flex items-center justify-center text-xs font-600 shrink-0',
                isPast    && 'bg-success text-white',
                isCurrent && 'bg-brand text-white',
                !isPast && !isCurrent && 'bg-surface-muted text-ink-tertiary border border-surface-border'
              )}>
                {isPast ? <Check className="w-3.5 h-3.5" /> : idx + 1}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className={clsx(
                  'text-sm truncate',
                  isCurrent && 'font-500 text-brand',
                  isPast    && 'text-ink-secondary',
                  !isPast && !isCurrent && 'text-ink-secondary'
                )}>
                  {step.label}
                </p>
                {isCurrent && (
                  <p className="text-2xs text-brand/70">Paso actual</p>
                )}
                {isNext && !isCurrent && (
                  <p className="text-2xs text-ink-tertiary">Click para avanzar</p>
                )}
              </div>

              {/* Arrow for actionable steps */}
              {isNext && !isCurrent && !acting && (
                <ChevronRight className="w-4 h-4 text-ink-tertiary shrink-0" />
              )}
              {acting && isNext && (
                <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin shrink-0" />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
