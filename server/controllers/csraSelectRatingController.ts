import { Request, Response } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import { AssessmentSubmitType } from '../utils/getAssessmentSubmitStatus'
import CsraFormController, { CsraFormParamType } from './csraFormController'
import required from '../lib/transactionFlow/validations/required'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default class CsraSelectRatingController extends CsraFormController<CsraFormParamType> {
  constructor(services: Dependencies) {
    super(
      {
        auditPage: Page.PRISONER_CSRA_SELECT_RATING,
        validators: {
          selectedRating: { validators: [required('Select a CSRA rating')] },
        },
        viewPath: 'pages/csraSelectRating',
      },
      services,
    )
  }

  protected override async setupLocals(req: Request<CsraFormParamType>, res: Response): Promise<boolean> {
    if (!(await super.setupLocals(req, res))) {
      return false
    }

    const { locals } = res
    const { prisonerNumber } = req.params
    const {
      user: { username },
      submitType,
      assessmentAnswers,
    } = locals

    locals.csra = await this.csraService.getCurrentRating(username, prisonerNumber)
    locals.isProvisional = submitType === AssessmentSubmitType.PROVISIONAL
    locals.isHighGeneral = Boolean(
      assessmentAnswers.offenceMurderManslaughter ||
      assessmentAnswers.offenceAssistingSuicide ||
      assessmentAnswers.offenceSexualAssault,
    )
    locals.selectedRating = req.body?.selectedRating || req.query?.selectedRating || null
    return true
  }

  protected override getNextLink(req: Request<CsraFormParamType>, res: Response): string {
    return `${res.locals.assessmentUrl}/confirm-rating/${res.locals.selectedRating}`
  }

  protected override validate(req: Request<CsraFormParamType>, res: Response): boolean {
    const { allowedRatings, selectedRating } = res.locals
    if (typeof selectedRating !== 'string' || !allowedRatings.includes(selectedRating)) {
      res.locals.validationErrors = res.locals.validationErrors || {}
      res.locals.validationErrors.selectedRating = { text: 'Select a CSRA rating' }
      return false
    }

    return super.validate(req, res)
  }
}
