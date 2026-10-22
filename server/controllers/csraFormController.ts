import { Request, Response } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import { Page } from '../services/auditService'
import { AssessmentSubmitType, getAssessmentSubmitStatus } from '../utils/getAssessmentSubmitStatus'
import FormController, { FormControllerOptions } from './formController'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export type CsraFormControllerOptions = FormControllerOptions & {
  auditPage: Page
}

export type CsraFormParamType = {
  prisonerNumber: string
  assessmentId: string
}

export default abstract class CsraFormController<
  ParamType extends CsraFormParamType,
> extends FormController<ParamType> {
  protected auditPage: Page

  constructor(options: CsraFormControllerOptions, { auditService, csraService }: Dependencies) {
    super(options)
    this.auditPage = options.auditPage
    this.auditService = auditService
    this.csraService = csraService
  }

  protected auditService: Services['auditService']

  protected csraService: Services['csraService']

  protected override async setupLocals(req: Request<ParamType>, res: Response): Promise<boolean> {
    if (!(await super.setupLocals(req, res))) {
      return false
    }

    const { locals } = res
    const { assessmentId, prisonerNumber } = req.params
    const {
      prisoner,
      user: { username },
    } = locals

    locals.assessment = await this.csraService.getCsraAssessment(username, prisonerNumber, assessmentId)
    if (!locals.assessment) {
      throw NotFound(`No CSRA assessment found for ID: ${assessmentId}`)
    }

    locals.prisonerLink = `/prisoner/${prisoner.prisonerNumber}`
    locals.assessmentUrl = `${locals.prisonerLink}/csra/${assessmentId}`
    locals.cancelLink = locals.assessmentUrl
    locals.assessmentAnswers = getAnswersFromAssessment(locals.assessment)

    const { submitType, allowedRatings } = getAssessmentSubmitStatus(
      locals.assessment,
      locals.assessmentAnswers,
      prisoner,
    )
    if (submitType === AssessmentSubmitType.NONE) {
      res.redirect(locals.cancelLink)
      return false
    }
    locals.allowedRatings = allowedRatings
    locals.submitType = submitType

    return true
  }

  protected override async render(req: Request<ParamType>, res: Response) {
    const { assessmentId } = req.params
    const {
      user: { username },
    } = res.locals

    await this.auditService.logPageView(this.auditPage, {
      who: username,
      subjectId: assessmentId,
      subjectType: 'ASSESSMENT_ID',
      correlationId: req.id,
    })

    await super.render(req, res)
  }
}
