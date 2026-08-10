import { type RequestHandler } from 'express'
import { getRatingOptions } from '../utils/utils'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import logger from '../../logger'
import { parseUkDate, validateUkDate, type UkDateValidationError } from '../utils/utils'
import { firstQueryValue, toArray } from '../utils/queryUtils'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

const buildDateValidationMessage = (fieldLabel: string, errorType: UkDateValidationError): string => {
  const label = `'${fieldLabel}'`
  switch (errorType) {
    case 'WRONG_FORMAT':
      return `${label} must be a date in the correct format, for example, 17/5/2024`
    case 'INCOMPLETE':
      return `${label} must be a full date, for example 17/5/2024`
    case 'NON_EXISTENT':
      return `${label} must be a real date`
    default:
      return `${label} must be a real date`
  }
}

const DEFAULT_SORT = 'REVIEW_DUE_BY'
const DEFAULT_DIRECTION: 'ASC' | 'DESC' = 'DESC'

const toSortDirection = (value?: string): 'ASC' | 'DESC' | undefined => {
  if (!value) return undefined

  const upper = value.toUpperCase()
  if (upper === 'ASC' || upper === 'ASCENDING') return 'ASC'
  if (upper === 'DESC' || upper === 'DESCENDING') return 'DESC'
  return undefined
}

export default class DueForReviewController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler = async (req, res, next) => {
    const { auditService, csraService } = this.dependencies
    await auditService.logPageView(Page.DUE_FOR_REVIEW, { who: res.locals.user.username, correlationId: req.id })

    try {
      const selectedRatingTypes = toArray(req.query.ratingType)
      const reviewDateFromRaw = firstQueryValue(req.query.reviewDateFrom)
      const reviewDateToRaw = firstQueryValue(req.query.reviewDateTo)
      const sort = firstQueryValue(req.query.sort)?.toUpperCase() || DEFAULT_SORT
      const direction = toSortDirection(firstQueryValue(req.query.direction)) || DEFAULT_DIRECTION
      const hasSelectedFilters = Boolean(selectedRatingTypes.length || reviewDateFromRaw || reviewDateToRaw)

      const validationErrors: Record<string, { text: string }> = {}
      const reviewDateFromErrorType = validateUkDate(reviewDateFromRaw)
      if (reviewDateFromErrorType) {
        validationErrors.reviewDateFrom = {
          text: buildDateValidationMessage('Review date from', reviewDateFromErrorType),
        }
      }
      const reviewDateToErrorType = validateUkDate(reviewDateToRaw)
      if (reviewDateToErrorType) {
        validationErrors.reviewDateTo = {
          text: buildDateValidationMessage('Review date to', reviewDateToErrorType),
        }
      }
      if (Object.keys(validationErrors).length) {
        res.locals.validationErrors = validationErrors
      }

      const prisonersResult = await csraService.getHighRiskDueForReview(
        res.locals.user.username,
        res.locals.feComponents?.sharedData?.activeCaseLoad?.caseLoadId,
        {
          ratingTypes: selectedRatingTypes.length ? selectedRatingTypes : undefined,
          reviewDateFrom: parseUkDate(reviewDateFromRaw),
          reviewDateTo: parseUkDate(reviewDateToRaw),
          sort,
          direction,
        },
      )

      const ratingTypeOptions = getRatingOptions(selectedRatingTypes, prisonersResult.availableRatingTypes)

      return res.render('pages/dueForReview', {
        title: 'High risk prisoners due for review',
        prisoners: prisonersResult.content,
        totalResults: prisonersResult.totalResults,
        ratingTypeOptions,
        reviewDateFrom: reviewDateFromRaw,
        reviewDateTo: reviewDateToRaw,
        sort,
        direction,
        hasSelectedFilters,
      })
    } catch (error) {
      logger.error('Error fetching prisoners for due-for-review page', error)
      return next(error)
    }
  }
}
