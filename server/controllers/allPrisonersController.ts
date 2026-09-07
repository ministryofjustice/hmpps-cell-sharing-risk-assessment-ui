import { type RequestHandler } from 'express'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import logger from '../../logger'
import {
  enumLabel,
  getRatingOptions,
  parseUkDate,
  RATING_VALUES,
  validateUkDate,
  type UkDateValidationError,
} from '../utils/utils'
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

const DEFAULT_SORT = 'ASSESSED_ON'
const DEFAULT_DIRECTION: 'ASC' | 'DESC' = 'DESC'

const SORT_OPTIONS = ['NAME', 'ASSESSED_ON', 'ASSESSMENT_TYPE', 'RATING'] as const

const toSortDirection = (value?: string): 'ASC' | 'DESC' | undefined => {
  if (!value) return undefined

  const upper = value.toUpperCase()
  if (upper === 'ASC' || upper === 'ASCENDING') return 'ASC'
  if (upper === 'DESC' || upper === 'DESCENDING') return 'DESC'
  return undefined
}

const toSort = (value?: string): string => {
  const upper = value?.toUpperCase()
  return upper && SORT_OPTIONS.includes(upper as (typeof SORT_OPTIONS)[number]) ? upper : DEFAULT_SORT
}

const toAllowedValues = (values: string[], allowed: readonly string[]): string[] =>
  values.map(value => value.toUpperCase()).filter(value => allowed.includes(value))

const ASSESSMENT_TYPE_VALUES = ['ASSESSMENT', 'REVIEW'] as const
const ASSESSMENT_TYPE_OPTIONS = ASSESSMENT_TYPE_VALUES.map(type => ({ value: type, text: enumLabel(type) }))
const getAssessmentTypeOptions = (selectedTypes: string[]) =>
  ASSESSMENT_TYPE_OPTIONS.map(option => ({ ...option, checked: selectedTypes.includes(option.value) }))

export default class AllPrisonersController {
  constructor(private readonly dependencies: Dependencies) {}

  index: RequestHandler = async (req, res, next) => {
    const { auditService, csraService } = this.dependencies
    await auditService.logPageView(Page.ALL_PRISONERS, { who: res.locals.user.username, correlationId: req.id })

    try {
      const selectedRatings = toAllowedValues(toArray(req.query.rating), RATING_VALUES)
      const selectedAssessmentTypes = toAllowedValues(toArray(req.query.assessmentType), ASSESSMENT_TYPE_VALUES)
      const assessmentDateFromRaw = firstQueryValue(req.query.assessmentDateFrom)
      const assessmentDateToRaw = firstQueryValue(req.query.assessmentDateTo)
      const sort = toSort(firstQueryValue(req.query.sort))
      const direction = toSortDirection(firstQueryValue(req.query.direction)) || DEFAULT_DIRECTION
      const page = Math.max(1, parseInt(firstQueryValue(req.query.page) || '1', 10))
      const hasSelectedFilters = Boolean(
        selectedRatings.length || selectedAssessmentTypes.length || assessmentDateFromRaw || assessmentDateToRaw,
      )

      const validationErrors: Record<string, { text: string }> = {}
      const assessmentDateFromErrorType = validateUkDate(assessmentDateFromRaw)
      if (assessmentDateFromErrorType) {
        validationErrors.assessmentDateFrom = {
          text: buildDateValidationMessage('Assessment date from', assessmentDateFromErrorType),
        }
      }
      const assessmentDateToErrorType = validateUkDate(assessmentDateToRaw)
      if (assessmentDateToErrorType) {
        validationErrors.assessmentDateTo = {
          text: buildDateValidationMessage('Assessment date to', assessmentDateToErrorType),
        }
      }
      if (Object.keys(validationErrors).length) {
        res.locals.validationErrors = validationErrors
      }

      const pageSize = 25

      const prisonersResult = await csraService.getPrisonPrisoners(
        res.locals.user.username,
        res.locals.feComponents?.sharedData?.activeCaseLoad?.caseLoadId,
        {
          ratings: selectedRatings.length ? selectedRatings : undefined,
          assessmentTypes: selectedAssessmentTypes.length ? selectedAssessmentTypes : undefined,
          fromDate: parseUkDate(assessmentDateFromRaw),
          toDate: parseUkDate(assessmentDateToRaw),
          sort,
          direction,
          page: page - 1,
          size: pageSize,
        },
      )

      return res.render('pages/allPrisoners', {
        title: 'CSRA ratings for all prisoners',
        prisoners: prisonersResult.content,
        totalResults: prisonersResult.totalElements,
        ratingOptions: getRatingOptions(selectedRatings),
        assessmentTypeOptions: getAssessmentTypeOptions(selectedAssessmentTypes),
        assessmentDateFrom: assessmentDateFromRaw,
        assessmentDateTo: assessmentDateToRaw,
        sort,
        direction,
        hasSelectedFilters,
        selectedRatings,
        selectedAssessmentTypes,
        currentPage: prisonersResult.page + 1,
        totalPages: prisonersResult.totalPages,
        pageSize,
      })
    } catch (error) {
      logger.error('Error fetching prisoners for all-prisoners page', error)
      return next(error)
    }
  }
}
