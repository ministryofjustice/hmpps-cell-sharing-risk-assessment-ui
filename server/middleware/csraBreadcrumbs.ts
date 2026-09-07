import { type RequestHandler } from 'express'

import { convertToTitleCase } from '../utils/utils'
import { ORIGINS, resolveOrigin } from '../utils/breadcrumbOrigins'
import { type Breadcrumb, pushBreadcrumbs } from './addBreadcrumb'

/** Which of the prisoner's CSRA pages is being rendered, i.e. where the trail stops. */
export type CsraPage = 'current' | 'history' | 'review'

/**
 * Builds the breadcrumb trail for a prisoner's CSRA pages, including the worklist they were reached
 * from where there is one:
 *
 *   DPS > CSRA > High risk prisoners due for review > Daniel Havers > CSRA history
 *
 * The "Digital Prison Services" crumb is added globally in app.ts, so this starts at CSRA.
 *
 * Must run after checkPrisonerAccess, which is what puts the prisoner on res.locals.
 *
 * Also stashes `fromKey`/`fromQuery` on res.locals so the templates can keep the origin alive on
 * their own links — every link out of these pages loses it otherwise.
 */
export default function csraBreadcrumbs(page: CsraPage): RequestHandler<{ prisonerNumber: string }> {
  return (req, res, next) => {
    const { prisonerNumber } = req.params
    const { prisoner } = res.locals

    const fromKey = resolveOrigin(req.query.from)
    // Built from the resolved key, never from the raw query value.
    const fromQuery = fromKey ? `?from=${fromKey}` : ''
    res.locals.fromKey = fromKey
    res.locals.fromQuery = fromQuery

    const prisonerName = convertToTitleCase(`${prisoner?.firstName ?? ''} ${prisoner?.lastName ?? ''}`.trim())

    const crumbs: Breadcrumb[] = [{ title: 'CSRA', href: '/' }]
    if (fromKey) crumbs.push(ORIGINS[fromKey])

    // The page you are on is always the last crumb, and has no href — the GOV.UK component renders
    // one without an href as plain text marked aria-current="page".
    crumbs.push(
      page === 'current'
        ? { title: prisonerName }
        : { title: prisonerName, href: `/prisoner/${prisonerNumber}${fromQuery}` },
    )

    if (page === 'history') {
      crumbs.push({ title: 'CSRA history' })
    }

    if (page === 'review') {
      crumbs.push(
        { title: 'CSRA history', href: `/prisoner/${prisonerNumber}/history${fromQuery}` },
        { title: 'CSRA review' },
      )
    }

    pushBreadcrumbs(res, ...crumbs)

    next()
  }
}
