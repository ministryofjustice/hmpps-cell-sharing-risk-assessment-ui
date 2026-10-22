import { Request, Response } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import required from '../lib/transactionFlow/validations/required'
import validDate from '../lib/transactionFlow/validations/validDate'
import futureDate from '../lib/transactionFlow/validations/futureDate'
import { capFirst, csraRatingLabel, parseUkDate } from '../utils/utils'
import { CsraAssessmentStageRequest } from '../data/csraApiTypes'
import CsraFormController, { CsraFormParamType } from './csraFormController'
import { AssessmentSubmitType } from '../utils/getAssessmentSubmitStatus'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

type CsraConfirmRatingParamType = CsraFormParamType & {
  rating: string
}

export default class CsraConfirmRatingController extends CsraFormController<CsraConfirmRatingParamType> {
  constructor(services: Dependencies) {
    super(
      {
        auditPage: Page.PRISONER_CSRA_CONFIRM_RATING,
        validations: {
          assessmentComment: [required('Enter an assessment comment')],
        },
        viewPath: 'pages/csraConfirmRating',
      },
      services,
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
    return true
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
    const { assessmentComment, nextReviewDate } = req.body
    const ratingData: CsraAssessmentStageRequest = {
      ...res.locals.assessmentAnswers,
      rating,
      assessmentComment,
    }

    if (submitType === AssessmentSubmitType.FINAL) {
      await this.csraService.submitFinalRating(username, prisonerNumber, assessmentId, {
        ...ratingData,
        nextReviewDate: parseUkDate(nextReviewDate as string),
      })
    } else {
      await this.csraService.submitProvisionalRating(username, prisonerNumber, assessmentId, ratingData)
    }

    const formattedName = capFirst(prisoner.firstName.trim().toLowerCase())
    const formattedRating = csraRatingLabel(
      rating,
      submitType === AssessmentSubmitType.PROVISIONAL ? 'PROVISIONAL' : null,
    ).toLowerCase()
    req.flash('success', {
      title: 'CSRA rating confirmed',
      content: `${formattedName}’s CSRA rating has been confirmed as ${formattedRating}.`,
    })
  }

  protected override getValidations(req: Request<CsraConfirmRatingParamType>, res: Response) {
    const validations = super.getValidations(req, res)

    if (req.params.rating !== 'HIGH_GENERAL' || res.locals.submitType !== AssessmentSubmitType.FINAL) {
      return validations
    }

    return {
      ...validations,
      nextReviewDate: [
        required('Enter or select a date'),
        validDate({
          WRONG_FORMAT: 'Enter the date in the correct format, for example, 17/5/2024',
          INCOMPLETE: 'Enter a full date, for example 17/5/2024',
          NON_EXISTENT: 'Enter a real date',
        }),
        futureDate('Select an available date from the calendar'),
      ],
    }
  }

  protected override getNextLink(req: Request<CsraConfirmRatingParamType>, res: Response): string {
    return res.locals.prisonerLink
  }
}
