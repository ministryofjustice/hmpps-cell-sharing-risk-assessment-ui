import { type RequestHandler } from 'express'

import type { CsraReviewHistory } from '../data/csraApiTypes'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import {
  buildPagination,
  formatMonthYear,
  getCsraHistoryRatingOptions,
  parseCsraHistoryQuery,
  parseUkDate,
  validateUkDate,
} from '../utils/utils'
import { populateUserDisplayNames } from '../utils/populateUserDisplayNames'

type Dependencies = Pick<Services, 'auditService' | 'csraService' | 'manageUsersService'>

const buildDateValidationMessage = (
  fieldLabel: string,
  errorType: 'WRONG_FORMAT' | 'INCOMPLETE' | 'NON_EXISTENT',
): string => {
  const label = `'${fieldLabel}'`
  switch (errorType) {
    case 'WRONG_FORMAT':
      return `${label} must be a date in the correct format, for example, 17/5/2024`
    case 'INCOMPLETE':
      return `${label} must be a full date, for example 17/5/2024`
    case 'NON_EXISTENT':
      return `${label} must be a real date`
    default:
      return null
  }
}

const buildSummaryRange = (history: CsraReviewHistory): string | undefined => {
  const first = formatMonthYear(history.summary.firstAssessmentDate)
  const last = formatMonthYear(history.summary.lastAssessmentDate)
  if (!first && !last) return undefined
  if (!first) return last
  if (!last) return first
  return first === last || history.summary.totalCsras === 1 ? first : `${first} – ${last}`
}

const buildValidationErrors = (fromDateRaw?: string, toDateRaw?: string) => {
  const validationErrors: Record<string, { text: string }> = {}

  const fromDateErrorType = validateUkDate(fromDateRaw)
  if (fromDateErrorType)
    validationErrors.fromDate = { text: buildDateValidationMessage('Date from', fromDateErrorType) }

  const toDateErrorType = validateUkDate(toDateRaw)
  if (toDateErrorType) validationErrors.toDate = { text: buildDateValidationMessage('Date to', toDateErrorType) }

  if (!validationErrors.fromDate && !validationErrors.toDate && fromDateRaw && toDateRaw) {
    const from = parseUkDate(fromDateRaw)
    const to = parseUkDate(toDateRaw)
    if (from && to && from > to) {
      validationErrors.fromDate = { text: `'Date from' must be on or before 'Date to'` }
    }
  }

  return validationErrors
}

export default class PrisonerCsraHistoryController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler<{ prisonerNumber: string }> = async (req, res) => {
    const { auditService, csraService, manageUsersService } = this.dependencies
    const { prisonerNumber } = req.params
    const { username } = res.locals.user
    const { prisoner } = res.locals

    const { ratings, establishments, fromDateRaw, toDateRaw, page, apiQuery } = parseCsraHistoryQuery(req.query)
    const validationErrors = buildValidationErrors(fromDateRaw, toDateRaw)

    if (Object.keys(validationErrors).length) {
      res.locals.validationErrors = validationErrors
    }

    const validApiQuery = { ...apiQuery }
    if (validationErrors.fromDate) validApiQuery.fromDate = undefined
    if (validationErrors.toDate) validApiQuery.toDate = undefined

    const history = await csraService.getHistory(username, prisonerNumber, validApiQuery)

    const interimReviewerUsernames = history.content
      .map(review => review.interimReviewer)
      .filter((reviewer): reviewer is string => Boolean(reviewer))
    if (interimReviewerUsernames.length) {
      await populateUserDisplayNames(res.locals, manageUsersService, username, interimReviewerUsernames)
    }

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

    const availableRatings = history.summary.ratings
    const availableEstablishments = history.summary.establishments
    const establishmentNames = Object.fromEntries(
      availableEstablishments.map(({ prisonId, prisonName }) => [prisonId, prisonName]),
    )

    const pagination =
      history.totalPages > 1
        ? buildPagination(page, history.totalPages, history.totalElements, history.size, baseQueryParams.toString())
        : null

    return res.render('pages/prisonerCsraHistory', {
      prisonerNumber,
      prisoner,
      history,
      summaryRange: buildSummaryRange(history),
      ratingOptions: getCsraHistoryRatingOptions(ratings, availableRatings),
      establishmentOptions: availableEstablishments.map(establishment => ({
        value: establishment.prisonId,
        text: establishment.prisonName,
        checked: establishments.includes(establishment.prisonId),
      })),
      establishmentNames,
      pagination,
      filters: {
        ratings,
        establishments,
        fromDate: fromDateRaw ?? '',
        toDate: toDateRaw ?? '',
      },
      hasHistory: history.summary.totalCsras > 0,
      hasResults: history.totalElements > 0,
    })
  }
}
