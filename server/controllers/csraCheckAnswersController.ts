import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import flowConfig from '../lib/transactionFlow/config'
import { Page } from '../services/auditService'
import { AssessmentSubmitType, getAssessmentSubmitStatus } from '../utils/getAssessmentSubmitStatus'
import { appendReferrers, referrerStack } from '../utils/breadcrumbOrigins'
import getOffenceEvidenceMap from '../utils/getOffenceEvidenceMap'
import renderCsraAssessmentSubmitted from '../utils/renderCsraAssessmentSubmitted'

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

    if (assessment.finalResult) {
      renderCsraAssessmentSubmitted(res, prisoner.prisonerNumber)
      return
    }

    const referrers = referrerStack(req.query.referrer)
    const assessmentUrl = appendReferrers(`/prisoner/${prisoner.prisonerNumber}/csra/${assessmentId}`, referrers)
    const assessmentAnswers = getAnswersFromAssessment(assessment)

    const submitStatus = getAssessmentSubmitStatus(assessment, assessmentAnswers, prisoner, referrers)
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
      flowConfig,
      referrers,
      backLink: assessmentUrl,
      cancelLink: assessmentUrl,
    })
  }
}
