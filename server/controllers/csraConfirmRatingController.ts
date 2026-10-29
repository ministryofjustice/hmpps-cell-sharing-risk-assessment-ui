import { Request, Response } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import required from '../lib/transactionFlow/validations/required'
import validDate from '../lib/transactionFlow/validations/validDate'
import futureDate from '../lib/transactionFlow/validations/futureDate'
import { capFirst, csraRatingLabel, parseUkDate } from '../utils/utils'
import {
  CsraAssessmentStageRequest,
  CsraRiskToCategory,
  csraRiskToCategoryLabelMap,
  csraRiskToCategoryOrder,
  CsraVulnerabilityCategory,
  csraVulnerabilityCategoryLabelMap,
  csraVulnerabilityCategoryOrder,
} from '../data/csraApiTypes'
import CsraFormController, { CsraFormParamType } from './csraFormController'
import { AssessmentSubmitType } from '../utils/getAssessmentSubmitStatus'
import FeComponentsService from '../services/feComponentsService'
import ValidationFunction from '../lib/transactionFlow/validations/validationFunction'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

const selectedCategories = <Category extends string>(value: unknown, categories: readonly Category[]): Category[] => {
  let selections: unknown[]
  if (typeof value === 'string') {
    selections = [value]
  } else if (Array.isArray(value)) {
    selections = value
  } else {
    selections = []
  }

  return selections.filter(
    (category): category is Category =>
      typeof category === 'string' && categories.some(allowedCategory => allowedCategory === category),
  )
}

const validateCategories =
  <Category extends string>(categories: readonly Category[], errorMessage: string): ValidationFunction =>
  value => {
    if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
      return null
    }

    let selections: unknown[]
    if (typeof value === 'string') {
      selections = [value]
    } else if (Array.isArray(value)) {
      selections = value
    } else {
      return errorMessage
    }

    if (
      selections.some(
        selection => typeof selection !== 'string' || !categories.some(category => category === selection),
      ) ||
      (selections.some(selection => selection === 'NONE') && selections.length > 1)
    ) {
      return errorMessage
    }

    return null
  }

type CsraConfirmRatingParamType = CsraFormParamType & {
  rating: string
}

export default class CsraConfirmRatingController extends CsraFormController<CsraConfirmRatingParamType> {
  constructor(services: Dependencies) {
    super(
      {
        auditPage: Page.PRISONER_CSRA_CONFIRM_RATING,
        validators: {
          assessmentComment: { validators: [required('Enter an assessment comment')] },
          nextReviewDate: {
            validators: [
              required('Enter or select a date'),
              validDate({
                WRONG_FORMAT: 'Enter the date in the correct format, for example, 17/5/2024',
                INCOMPLETE: 'Enter a full date, for example 17/5/2024',
                NON_EXISTENT: 'Enter a real date',
              }),
              futureDate('Select an available date from the calendar'),
            ],
          },
          riskTo: {
            validators: [
              required('Select who this person is a risk to'),
              validateCategories(csraRiskToCategoryOrder, 'Select valid groups this person is a risk to'),
            ],
          },
          ...Object.fromEntries(
            csraRiskToCategoryOrder
              .filter(cat => cat !== 'NONE')
              .map(cat => [
                `RISK_TO_${cat}_DETAILS`,
                {
                  summaryPrefix: csraRiskToCategoryLabelMap[cat],
                  validators: [required('Enter details of who this person is a risk to')],
                },
              ]),
          ),
          vulnerabilities: {
            validators: [
              required('Select whether this person is part of a vulnerable or at risk group'),
              validateCategories(csraVulnerabilityCategoryOrder, 'Select valid vulnerable or at risk groups'),
            ],
          },
          ...Object.fromEntries(
            csraVulnerabilityCategoryOrder
              .filter(cat => cat !== 'NONE')
              .map(cat => [
                `VULNERABILITIES_${cat}_DETAILS`,
                {
                  summaryPrefix: csraVulnerabilityCategoryLabelMap[cat],
                  validators: [required('Enter details of why this person is vulnerable or at risk')],
                },
              ]),
          ),
        },
        viewPath: 'pages/csraConfirmRating',
      },
      services,
    )
  }

  private populateDynamicFields(req: Request<CsraConfirmRatingParamType>, res: Response) {
    const { rating } = req.params
    if (rating !== 'HIGH_SPECIFIC') {
      return
    }

    const { locals } = res
    const selectedRiskTo = selectedCategories(locals.values?.riskTo, csraRiskToCategoryOrder)
    const selectedVulnerabilities = selectedCategories(locals.values?.vulnerabilities, csraVulnerabilityCategoryOrder)

    locals.riskToItems = csraRiskToCategoryOrder.flatMap(
      cat =>
        [
          cat === 'NONE'
            ? {
                divider: 'or',
              }
            : null,
          {
            value: cat,
            text: csraRiskToCategoryLabelMap[cat],
            checked: selectedRiskTo.includes(cat),
            ...(cat === 'NONE'
              ? { behaviour: 'exclusive' }
              : {
                  conditional: {
                    html: FeComponentsService.getComponent('govukTextarea', {
                      id: `RISK_TO_${cat}_DETAILS`,
                      name: `RISK_TO_${cat}_DETAILS`,
                      classes: 'govuk-!-width-three-quarters',
                      label: { text: 'Provide details of who this person is a risk to.' },
                      value: locals.values?.[`RISK_TO_${cat}_DETAILS`],
                      errorMessage: locals.validationErrors?.[`RISK_TO_${cat}_DETAILS`],
                    }),
                  },
                }),
          },
        ].filter(i => i),

      (locals.vulnerabilitiesItems = csraVulnerabilityCategoryOrder.flatMap(cat =>
        [
          cat === 'NONE'
            ? {
                divider: 'or',
              }
            : null,
          {
            value: cat,
            text: csraVulnerabilityCategoryLabelMap[cat],
            checked: selectedVulnerabilities.includes(cat),
            ...(cat === 'NONE'
              ? { behaviour: 'exclusive' }
              : {
                  conditional: {
                    html: FeComponentsService.getComponent('govukTextarea', {
                      id: `VULNERABILITIES_${cat}_DETAILS`,
                      name: `VULNERABILITIES_${cat}_DETAILS`,
                      classes: 'govuk-!-width-three-quarters',
                      label: { text: 'Provide details of why this person is vulnerable or at risk.' },
                      value: locals.values?.[`VULNERABILITIES_${cat}_DETAILS`],
                      errorMessage: locals.validationErrors?.[`VULNERABILITIES_${cat}_DETAILS`],
                    }),
                  },
                }),
          },
        ].filter(i => i),
      )),
    )
  }

  protected override async setupLocals(req: Request<CsraConfirmRatingParamType>, res: Response): Promise<boolean> {
    if (!(await super.setupLocals(req, res))) {
      return false
    }

    const { locals } = res
    const { prisonerNumber, rating } = req.params
    const {
      allowedRatings,
      user: { username },
    } = locals

    if (!allowedRatings.includes(rating)) {
      res.redirect(locals.cancelLink)
      return false
    }

    locals.backLink = `${locals.cancelLink}/select-rating?selectedRating=${rating}`
    locals.csra = await this.csraService.getCurrentRating(username, prisonerNumber)
    this.populateDynamicFields(req, res)
    return true
  }

  protected override validate(req: Request<CsraConfirmRatingParamType>, res: Response): boolean {
    const valid = super.validate(req, res)

    if (!valid) {
      this.populateDynamicFields(req, res)
    }

    return valid
  }

  protected override async sendPost(req: Request<CsraConfirmRatingParamType>, res: Response) {
    const {
      prisoner,
      submitType,
      user: { username },
    } = res.locals
    if (!['PROVISIONAL', 'FINAL'].includes(submitType)) {
      throw new Error(`Invalid submit type: ${submitType}`)
    }

    const { assessmentId, prisonerNumber, rating } = req.params
    const { assessmentComment, nextReviewDate, riskTo, vulnerabilities } = req.body as {
      assessmentComment: string
      nextReviewDate: string
      riskTo: CsraRiskToCategory[] | CsraRiskToCategory
      vulnerabilities: CsraVulnerabilityCategory[] | CsraVulnerabilityCategory
    }
    const ratingData: CsraAssessmentStageRequest = {
      ...res.locals.assessmentAnswers,
      rating,
      assessmentComment,
    }

    if (rating === 'HIGH_SPECIFIC') {
      ratingData.riskTo = selectedCategories(riskTo, csraRiskToCategoryOrder).map(cat => ({
        category: cat,
        details: req.body[`RISK_TO_${cat}_DETAILS`],
      }))
      ratingData.vulnerabilities = selectedCategories(vulnerabilities, csraVulnerabilityCategoryOrder).map(cat => ({
        category: cat,
        details: req.body[`VULNERABILITIES_${cat}_DETAILS`],
      }))
    }

    const isProvisional = submitType === AssessmentSubmitType.PROVISIONAL
    if (isProvisional) {
      await this.csraService.submitProvisionalRating(username, prisonerNumber, assessmentId, ratingData)
    } else {
      await this.csraService.submitFinalRating(username, prisonerNumber, assessmentId, {
        ...ratingData,
        nextReviewDate: parseUkDate(nextReviewDate),
      })
    }

    // Don't add a flash message for HIGH_SPECIFIC provisional ratings, as the user will be redirected to a confirmation
    //   page instead
    if (!(isProvisional && rating === 'HIGH_SPECIFIC')) {
      const formattedName = capFirst(prisoner.firstName.trim().toLowerCase())
      const formattedRating = csraRatingLabel(rating, isProvisional ? 'PROVISIONAL' : null).toLowerCase()
      req.flash('success', {
        title: `${isProvisional ? 'Provisional ' : ''}CSRA rating confirmed`,
        content: `${formattedName}’s CSRA rating has been confirmed as ${formattedRating}.`,
      })
    }
  }

  protected override getFieldsToValidate(req: Request<CsraConfirmRatingParamType>, res: Response): string[] {
    const { rating } = req.params
    const { submitType } = res.locals
    const fields = ['assessmentComment']

    if (rating.includes('HIGH') && submitType === AssessmentSubmitType.FINAL) {
      fields.push('nextReviewDate')
    }

    if (rating === 'HIGH_SPECIFIC') {
      fields.unshift(
        'riskTo',
        ...selectedCategories(req.body?.riskTo, csraRiskToCategoryOrder)
          .filter(cat => cat !== 'NONE')
          .map(cat => `RISK_TO_${cat}_DETAILS`),
        'vulnerabilities',
        ...selectedCategories(req.body?.vulnerabilities, csraVulnerabilityCategoryOrder)
          .filter(cat => cat !== 'NONE')
          .map(cat => `VULNERABILITIES_${cat}_DETAILS`),
      )
    }

    return fields
  }

  protected override getNextLink(req: Request<CsraConfirmRatingParamType>, res: Response): string {
    if (res.locals.submitType === AssessmentSubmitType.PROVISIONAL && req.params.rating === 'HIGH_SPECIFIC') {
      return `${res.locals.prisonerLink}/rating-confirmed`
    }

    return res.locals.prisonerLink
  }
}
