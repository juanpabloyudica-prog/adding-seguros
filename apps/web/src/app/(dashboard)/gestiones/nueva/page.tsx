'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { NewCaseModal } from '@/components/domain/cases/NewCaseModal'

// Standalone page for creating a new case.
// Supports pre-filling via query params:
//   ?person_id=<uuid>&person_name=<string>&policy_id=<uuid>&policy_number=<string>
//
// When accessed directly (e.g. from the gestiones list "+" button),
// opens the creation modal and navigates to the new case on success,
// or back to /gestiones on cancel.

function NewCasePage() {
  const router       = useRouter()
  const searchParams = useSearchParams()

  const personId     = searchParams.get('person_id')     ?? undefined
  const personName   = searchParams.get('person_name')   ?? undefined
  const policyId     = searchParams.get('policy_id')     ?? undefined
  const policyNumber = searchParams.get('policy_number') ?? undefined

  return (
    <NewCaseModal
      personId={personId}
      personName={personName}
      policyId={policyId}
      policyNumber={policyNumber}
      onClose={() => router.push('/gestiones')}
      onCreated={(caseId) => router.push(`/gestiones/${caseId}`)}
    />
  )
}

export default function NewCasePageWrapper() {
  return (
    <Suspense>
      <NewCasePage />
    </Suspense>
  )
}
