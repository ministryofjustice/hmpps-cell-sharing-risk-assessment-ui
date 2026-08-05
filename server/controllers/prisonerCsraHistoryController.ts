import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import { buildPagination, parseCsraHistoryQuery } from '../utils/utils'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default class PrisonerCsraHistoryController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler<{ prisonerNumber: string }> = async (req, res) => {
    const { auditService, csraService } = this.dependencies
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

    const baseQueryParams = new URLSearchParams()
    // Pagination links are built from these, so the worklist the prisoner was reached from has to be
    // among them or paging would drop it out of the breadcrumb trail.
    if (res.locals.fromKey) baseQueryParams.set('from', res.locals.fromKey)
    ratings.forEach(rating => baseQueryParams.append('ratings', rating))
    establishments.forEach(establishment => baseQueryParams.append('establishments', establishment))
    if (fromDateRaw) baseQueryParams.set('fromDate', fromDateRaw)
    if (toDateRaw) baseQueryParams.set('toDate', toDateRaw)

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
  }
}
