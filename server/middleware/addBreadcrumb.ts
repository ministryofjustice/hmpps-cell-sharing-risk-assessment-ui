import type { Response } from 'express'
import asyncMiddleware from './asyncMiddleware'

/**
 * One breadcrumb in the trail rendered by `views/macros/breadcrumb.njk`.
 *
 * `href` is optional: the GOV.UK breadcrumbs component renders an item without one as plain text
 * marked `aria-current="page"`, which is how the page you are actually on appears as the last crumb.
 */
export interface Breadcrumb {
  title: string
  href?: string
}

/** Appends breadcrumbs to the trail for this request. The single place `res.locals.breadcrumbs` is written. */
export function pushBreadcrumbs(res: Response, ...breadcrumbs: Breadcrumb[]): void {
  res.locals.breadcrumbs = [...(res.locals.breadcrumbs ?? []), ...breadcrumbs]
}

/** Middleware form, for a crumb that is the same on every request through a route or the whole app. */
export default function addBreadcrumb(breadcrumb: Breadcrumb) {
  return asyncMiddleware((req, res, next) => {
    pushBreadcrumbs(res, breadcrumb)

    next()
  })
}
