import { Router } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import { buildPagination, parseCsraHistoryQuery } from '../utils/utils'
import checkPrisonerAccess from '../middleware/checkPrisonerAccess'

export default function routes({
  auditService,
  prisonerSearchService,
  csraService,
  prisonApiService,
  manageUsersService,
}: Services): Router {
  const router = Router()

  // Guards all prisoner routes: enforces the caseload/role access rules and, on success, stashes
  // the looked-up prisoner on res.locals.prisoner for the handlers to reuse.
  const requirePrisonerAccess = checkPrisonerAccess(prisonerSearchService, manageUsersService)

  router.get('/', async (req, res, next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })

    const now = new Date()
    return res.render('pages/index', { currentTime: now.toISOString() })
  })

  router.get('/prisoner/:prisonerNumber', requirePrisonerAccess, async (req, res) => {
    const { prisonerNumber } = req.params
    const { username } = res.locals.user
    const { prisoner } = res.locals

    const csra = await csraService.getCurrentRating(username, prisonerNumber)

    await auditService.logPageView(Page.PRISONER_CSRA, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    return res.render('pages/prisonerCsra', { prisoner, csra, prisonerNumber })
  })

  router.get('/prisoner/:prisonerNumber/history', requirePrisonerAccess, async (req, res) => {
    const { prisonerNumber } = req.params
    const { username } = res.locals.user
    const { prisoner } = res.locals

    const { ratings, establishments, fromDateRaw, toDateRaw, page, apiQuery } = parseCsraHistoryQuery(req.query)

    const history = await csraService.getHistory(username, prisonerNumber, apiQuery)

    await auditService.logPageView(Page.PRISONER_CSRA_HISTORY, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    // Base query for the pagination links: keep the active filters, drop the page param (each link
    // appends its own). Use the raw (as-typed) date values so the filter inputs stay populated.
    const baseQueryParams = new URLSearchParams()
    ratings.forEach(rating => baseQueryParams.append('ratings', rating))
    establishments.forEach(establishment => baseQueryParams.append('establishments', establishment))
    if (fromDateRaw) baseQueryParams.set('fromDate', fromDateRaw)
    if (toDateRaw) baseQueryParams.set('toDate', toDateRaw)

    // prisonId -> prisonName lookup for the "Recorded at" line, once the API supplies establishments.
    const establishmentNames = Object.fromEntries(
      (history.summary.establishments ?? []).map(({ prisonId, prisonName }) => [prisonId, prisonName]),
    )

    return res.render('pages/prisonerCsraHistory', {
      prisonerNumber,
      prisoner,
      summary: history.summary,
      reviews: history.content,
      establishmentNames,
      pagination: buildPagination(
        page,
        history.totalPages,
        history.totalElements,
        history.size,
        baseQueryParams.toString(),
      ),
      filters: { ratings, establishments, fromDate: fromDateRaw ?? '', toDate: toDateRaw ?? '' },
    })
  })

  // Proxy the prisoner photo through the app so the browser never needs a backend token. On any error
  // (no image, prisoner unknown, backend down) fall back to a neutral placeholder so the banner still
  // renders.
  router.get('/prisoner/:prisonerNumber/image', requirePrisonerAccess, async (req, res) => {
    const { prisonerNumber } = req.params
    const { username } = res.locals.user

    try {
      const { body, contentType } = await prisonApiService.getPrisonerImage(username, prisonerNumber)
      res.set('Content-Type', contentType)
      res.set('Cache-Control', 'private, max-age=3600')
      return res.send(body)
    } catch {
      return res.redirect('/assets/images/prisoner-placeholder.svg')
    }
  })

  return router
}
