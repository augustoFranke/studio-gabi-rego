import { useCallback, useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export type UrlFilterValues = Record<string, string>

type Normalizers<T extends UrlFilterValues> = Partial<{
  [K in keyof T]: (value: string) => string
}>

type UseUrlFiltersOptions<T extends UrlFilterValues> = {
  defaults: T
  debounceMs?: number
  resetPageParam?: string
  normalize?: Normalizers<T>
}

export function useUrlFilters<T extends UrlFilterValues>(
  initial: T,
  { defaults, debounceMs = 300, resetPageParam = 'page', normalize }: UseUrlFiltersOptions<T>
) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [filters, setFilters] = useState(initial)

  const normalizeValue = useCallback((key: keyof T, value: string) => {
    const normalizer = normalize?.[key]
    return normalizer ? normalizer(value) : value
  }, [normalize])

  const buildQuery = useCallback((values: T) => {
    const params = new URLSearchParams()
    let hasFilters = false

    for (const key of Object.keys(values) as Array<keyof T>) {
      const normalized = normalizeValue(key, values[key])
      if (normalized && normalized !== defaults[key]) {
        params.set(String(key), normalized)
        hasFilters = true
      }
    }

    if (hasFilters && resetPageParam) {
      params.set(resetPageParam, '1')
    }

    return params.toString()
  }, [defaults, normalizeValue, resetPageParam])

  const applyFilters = useCallback((values: T) => {
    const nextQuery = buildQuery(values)
    const currentQuery = searchParams.toString()
    if (nextQuery === currentQuery) {
      return
    }
    router.push(nextQuery ? `${pathname}?${nextQuery}` : pathname)
  }, [buildQuery, pathname, router, searchParams])

  useEffect(() => {
    const filtersChanged = (Object.keys(defaults) as Array<keyof T>).some((key) => {
      const currentValue = searchParams.get(String(key)) ?? defaults[key]
      const normalized = normalizeValue(key, filters[key])
      return currentValue !== normalized
    })

    if (!filtersChanged) {
      return
    }

    const timer = setTimeout(() => {
      applyFilters(filters)
    }, debounceMs)

    return () => clearTimeout(timer)
  }, [applyFilters, debounceMs, defaults, filters, normalizeValue, searchParams])

  const clearFilters = useCallback(() => {
    router.push(pathname)
  }, [pathname, router])

  return { filters, setFilters, applyFilters, clearFilters }
}
