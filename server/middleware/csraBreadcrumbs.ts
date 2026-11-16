import { type RequestHandler } from 'express'

import { convertToTitleCase } from '../utils/utils'
import { appendReferrers, ORIGINS, type ReferrerKey, referrerStack, resolveOrigin } from '../utils/breadcrumbOrigins'
import { type Breadcrumb, pushBreadcrumbs } from './addBreadcrumb'

/** Which of the prisoner's CSRA pages is being rendered, i.e. where the trail stops. */
export type CsraPage = 'current' | 'history' | 'taskList' | 'view'

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
 * Also stashes `referrers` on res.locals, the stack of pages this one was reached through, so the
 * templates can keep the origin alive on their own links — every link out of these pages loses it
 * otherwise.
 */
export default function csraBreadcrumbs(page: CsraPage): RequestHandler<{ prisonerNumber: string }> {
  return (req, res, next) => {
    const { prisonerNumber } = req.params
    const { prisoner } = res.locals

    const fromKey = resolveOrigin(req.query.from)
    // A `from` link from a worklist seeds the stack; after that the `referrer` stack carries it.
    let referrers: ReferrerKey[] = referrerStack(req.query.referrer)
    if (!referrers.length && fromKey) referrers = [fromKey]
    res.locals.referrers = referrers

    const worklist = resolveOrigin(referrers[0])
    const prisonerName = convertToTitleCase(`${prisoner?.firstName ?? ''} ${prisoner?.lastName ?? ''}`.trim())

    const crumbs: Breadcrumb[] = [{ title: 'CSRA', href: '/' }]
    if (worklist) crumbs.push(ORIGINS[worklist])

    // The page you are on is always the last crumb, and has no href — the GOV.UK component renders
    // one without an href as plain text marked aria-current="page".
    crumbs.push(
      ['current', 'history'].includes(page)
        ? { title: prisonerName }
        : { title: prisonerName, href: appendReferrers(`/prisoner/${prisonerNumber}`, worklist ? [worklist] : []) },
    )

    pushBreadcrumbs(res, ...crumbs)

    next()
  }
}
