import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import { buildPagination, parseCsraHistoryQuery } from '../utils/utils'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default function prisonerCsraHistoryController({
  auditService,
  csraService,
}: Dependencies): RequestHandler<{ prisonerNumber: string }> {
  return async (req, res) => {
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
