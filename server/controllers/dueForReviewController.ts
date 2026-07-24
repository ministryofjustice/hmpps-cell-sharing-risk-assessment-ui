import { type RequestHandler } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import logger from '../../logger'
import { csraRatingLabel, parseUkDate } from '../utils/utils'
import { firstQueryValue, toArray } from '../utils/queryUtils'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

const toSortDirection = (value?: string): 'ASC' | 'DESC' | undefined => {
  if (!value) return undefined

  const upper = value.toUpperCase()
  if (upper === 'ASC' || upper === 'ASCENDING') return 'ASC'
  if (upper === 'DESC' || upper === 'DESCENDING') return 'DESC'
  return undefined
}

export default function dueForReviewController({ auditService, csraService }: Dependencies): RequestHandler {
  return async (req, res, next) => {
    await auditService.logPageView(Page.DUE_FOR_REVIEW, { who: res.locals.user.username, correlationId: req.id })

    try {
      const selectedRatingTypes = toArray(req.query.ratingType)
      const reviewDateFromRaw = firstQueryValue(req.query.reviewDateFrom)
      const reviewDateToRaw = firstQueryValue(req.query.reviewDateTo)
      const sort = firstQueryValue(req.query.sort)?.toUpperCase()
      const direction = toSortDirection(firstQueryValue(req.query.direction))
      const hasSelectedFilters = Boolean(selectedRatingTypes.length || reviewDateFromRaw || reviewDateToRaw)

      const validationErrors: Record<string, { text: string }> = {}
      if (reviewDateFromRaw && !parseUkDate(reviewDateFromRaw)) {
        validationErrors.reviewDateFrom = { text: "'Review date from' must be a real date" }
      }
      if (reviewDateToRaw && !parseUkDate(reviewDateToRaw)) {
        validationErrors.reviewDateTo = { text: "'Review date to' must be a real date" }
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

      return res.render('pages/dueForReview', {
        title: 'High risk prisoners due for review',
        prisoners: prisonersResult.content,
        ratingTypeOptions: prisonersResult.availableRatingTypes.map(ratingType => ({
          value: ratingType,
          text: csraRatingLabel(ratingType),
          checked: selectedRatingTypes.includes(ratingType),
        })),
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
