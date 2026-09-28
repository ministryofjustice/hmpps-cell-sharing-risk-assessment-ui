import { type RequestHandler } from 'express'

import type { CsraReviewSummary, CsraReviewHistory } from '../data/csraApiTypes'
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

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

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

const historyRatingValue = (review: CsraReviewSummary): string | undefined => {
  if (review.legacy) {
    switch (review.legacy.level) {
      case 'HI':
        return 'HIGH'
      case 'STANDARD':
        return 'STANDARD_LEGACY'
      case 'LOW':
      case 'MED':
      case 'PEND':
        return review.legacy.level
      default:
        return review.legacy.approvedResult || review.legacy.calculatedResult || undefined
    }
  }

  if (review.ratingStage === 'PROVISIONAL') {
    if (review.rating === 'HIGH_GENERAL') return 'HIGH_GENERAL_PROVISIONAL'
    if (review.rating === 'HIGH_SPECIFIC') return 'HIGH_SPECIFIC_PROVISIONAL'
  }

  if (review.ratingStage === 'INTERIM' && review.rating === 'HIGH_GENERAL') {
    return 'HIGH_GENERAL_INTERIM'
  }

  return review.rating
}

const buildAvailableRatings = (history: CsraReviewHistory): string[] => {
  const explicit = history.summary.ratings ?? []
  if (explicit.length) return explicit

  const values = new Set<string>()
  history.content.forEach(review => {
    const value = historyRatingValue(review)
    if (value) values.add(value)
  })

  return [...values]
}

const buildAvailableEstablishments = (history: CsraReviewHistory): { prisonId: string; prisonName: string }[] => {
  const explicit = history.summary.establishments ?? []
  if (explicit.length) return explicit

  const seen = new Set<string>()
  return history.content.flatMap(review => {
    const prisonId = review.prisonId?.toUpperCase()
    if (!prisonId || seen.has(prisonId)) return []
    seen.add(prisonId)
    return [{ prisonId, prisonName: review.prisonName || prisonId }]
  })
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
    const { auditService, csraService } = this.dependencies
    const { prisonerNumber } = req.params
    const { username } = res.locals.user
    const { prisoner } = res.locals

    const { ratings, establishments, fromDateRaw, toDateRaw, page, apiQuery } = parseCsraHistoryQuery(req.query)
    const validationErrors = buildValidationErrors(fromDateRaw, toDateRaw)

    if (Object.keys(validationErrors).length) {
      res.locals.validationErrors = validationErrors
    }

    // TODO: replace this with values from API call instead
    const fullHistory = await csraService.getHistory(username, prisonerNumber, { page: '0', size: '100' })

    const history = await csraService.getHistory(
      username,
      prisonerNumber,
      Object.keys(validationErrors).length
        ? {
            page: apiQuery.page,
            size: apiQuery.size,
          }
        : apiQuery,
    )

    await auditService.logPageView(Page.PRISONER_CSRA_HISTORY, {
      who: username,
      subjectId: prisonerNumber,
      subjectType: 'PRISONER_ID',
      correlationId: req.id,
    })

    const baseQueryParams = new URLSearchParams()
    if (res.locals.fromKey) baseQueryParams.set('from', res.locals.fromKey)
    ratings.forEach(rating => baseQueryParams.append('ratings', rating))
    establishments.forEach(establishment => baseQueryParams.append('establishments', establishment))
    if (fromDateRaw) baseQueryParams.set('fromDate', fromDateRaw)
    if (toDateRaw) baseQueryParams.set('toDate', toDateRaw)

    const selectedRatings = ratings
    const selectedEstablishments = establishments

    const availableRatings = buildAvailableRatings(fullHistory)
    const availableEstablishments = buildAvailableEstablishments(fullHistory)
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
      fullHistory,
      history,
      summaryRange: buildSummaryRange(history),
      ratingOptions: getCsraHistoryRatingOptions(selectedRatings, availableRatings),
      establishmentOptions: availableEstablishments.map(establishment => ({
        value: establishment.prisonId,
        text: establishment.prisonName,
        checked: selectedEstablishments.includes(establishment.prisonId),
      })),
      establishmentNames,
      pagination,
      filters: {
        ratings: selectedRatings,
        establishments: selectedEstablishments,
        fromDate: fromDateRaw ?? '',
        toDate: toDateRaw ?? '',
      },
      hasHistory: history.summary.totalCsras > 0,
      hasResults: history.totalElements > 0,
    })
  }
}
