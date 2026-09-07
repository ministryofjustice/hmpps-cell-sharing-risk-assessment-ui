import type { ParsedQs } from 'qs'

export const firstQueryValue = (value: ParsedQs[string]): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.toString().trim() || undefined

export const toArray = (value: ParsedQs[string]): string[] =>
  (Array.isArray(value) ? value : [value])
    .map(item => item?.toString().trim())
    .filter((item): item is string => Boolean(item))
