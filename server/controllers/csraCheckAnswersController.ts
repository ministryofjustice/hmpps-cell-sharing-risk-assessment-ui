import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import { getFlowConfig } from '../lib/transactionFlow/config'
import getAssessmentContext from '../lib/transactionFlow/assessmentContext'
import { Page } from '../services/auditService'
import { AssessmentSubmitType, getAssessmentSubmitStatus } from '../utils/getAssessmentSubmitStatus'
import getOffenceEvidenceMap from '../utils/getOffenceEvidenceMap'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

export default function csraCheckAnswersController({
  auditService,
  csraService,
}: Dependencies): RequestHandler<{ prisonerNumber: string; assessmentId: string }> {
  return async (req, res, _next) => {
    const { assessmentId, prisonerNumber } = req.params
    const {
      prisoner,
      user: { username },
    } = res.locals

    const assessment = await csraService.getCsraAssessment(username, prisonerNumber, assessmentId)
    if (!assessment) {
      throw NotFound(`No CSRA assessment found for ID: ${assessmentId}`)
    }

    const assessmentUrl = `/prisoner/${prisoner.prisonerNumber}/csra/${assessmentId}`
    const assessmentAnswers = getAnswersFromAssessment(assessment)

    const submitStatus = getAssessmentSubmitStatus(assessment, assessmentAnswers, prisoner)
    if (submitStatus.submitType === AssessmentSubmitType.NONE) {
      res.redirect(assessmentUrl)
      return
    }

    await auditService.logPageView(Page.PRISONER_CSRA_CHECK_ANSWERS, {
      who: username,
      subjectId: assessmentId,
      subjectType: 'ASSESSMENT_ID',
      correlationId: req.id,
    })

    res.render('pages/csraCheckAnswers', {
      prisoner,
      assessment,
      assessmentAnswers,
      offenceEvidenceMap: getOffenceEvidenceMap(assessmentAnswers),
      submitType: submitStatus.submitType,
      remainingTasks: submitStatus.remainingTasks,
      flowConfig: getFlowConfig(getAssessmentContext(assessment)),
      backLink: assessmentUrl,
      cancelLink: assessmentUrl,
    })
  }
}
