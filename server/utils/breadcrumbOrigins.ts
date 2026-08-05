import type { ParsedQs } from 'qs'
import type { Breadcrumb } from '../middleware/addBreadcrumb'
import { firstQueryValue } from './queryUtils'

/**
 * The screens a prisoner's CSRA pages can be reached from, keyed by the `from` query param value.
 *
 * A worklist appends `?from=<key>` when it links to a prisoner; the prisoner pages turn that key back
 * into a breadcrumb so you can get back to the list you started on.
 *
 * Only `due-for-review` and `all-prisoners` have screens behind them today. The other three are
 * homepage tiles pointing at routes that do not exist yet — they are seeded here so that building
 * each screen costs one link change rather than a change here as well.
 */
export const ORIGINS = {
  'due-for-review': { title: 'High risk prisoners due for review', href: '/due-for-review' },
  'all-prisoners': { title: 'CSRA ratings for all prisoners', href: '/all-prisoners' },
  'recent-arrivals': { title: 'Recent arrivals', href: '/recent-arrivals' },
  'assessments-in-progress': { title: 'Assessments in progress', href: '/assessments-in-progress' },
  'reviews-in-progress': { title: 'Reviews in progress', href: '/reviews-in-progress' },
} as const satisfies Record<string, Breadcrumb>

export type OriginKey = keyof typeof ORIGINS

/**
 * Resolve a raw `from` query value to a known origin, or undefined.
 *
 * The raw value is only ever compared, never used: an unrecognised one is dropped entirely rather
 * than echoed into a crumb title, an href or a re-emitted query param. That is what stops
 * `?from=https://evil.example` becoming a link on the page. `Object.hasOwn` rather than `in`, so
 * inherited names like `constructor` and `toString` are not treated as origins.
 */
export const resolveOrigin = (value: ParsedQs[string]): OriginKey | undefined => {
  const key = firstQueryValue(value)
  return key && Object.hasOwn(ORIGINS, key) ? (key as OriginKey) : undefined
}
