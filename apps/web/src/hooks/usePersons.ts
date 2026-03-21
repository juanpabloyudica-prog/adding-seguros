'use client'

import { useEffect, useState, useCallback } from 'react'
import { getPersons, getPerson } from '@/lib/api/persons'
import type { Person, PaginatedResponse } from '@adding/types'
import type { PersonDetail, ListPersonsParams } from '@/lib/api/persons'

// ─── usePersons — list with filters and pagination ────────────────────────────
export function usePersons(params: ListPersonsParams = {}) {
  const [data, setData]     = useState<PaginatedResponse<Person> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)

  // Serialize params to a stable key for useEffect dep
  const paramsKey = JSON.stringify(params)

  const fetch = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await getPersons(params)
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar personas')
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey])

  useEffect(() => { fetch() }, [fetch])

  return { data, loading, error, refetch: fetch }
}

// ─── usePersonDetail — single person with metadata ────────────────────────────
export function usePersonDetail(id: string | null) {
  const [data, setData]       = useState<PersonDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setError(null)
    getPerson(id)
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Error al cargar persona'))
      .finally(() => setLoading(false))
  }, [id])

  return { data, loading, error }
}
