import { type RequestHandler } from 'express'
import { NotFound } from 'http-errors'
import type { Services } from '../services'
import { Page } from '../services/auditService'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import flowConfig from '../lib/transactionFlow/config'
import { getRemainingTasks } from '../utils/getAssessmentSubmitStatus'
import getOffenceEvidenceMap from '../utils/getOffenceEvidenceMap'
import renderCsraAssessmentSubmitted from '../utils/renderCsraAssessmentSubmitted'

type Dependencies = Pick<Services, 'auditService' | 'csraService' | 'manageUsersService'>

export default function csraReviewProvisionalController({
  auditService,
  csraService,
  manageUsersService,
}: Dependencies): RequestHandler<{ prisonerNumber: string; assessmentId: string }> {
  return async (req, res) => {
    const { prisonerNumber, assessmentId } = req.params
    const { prisoner, user } = res.locals
    const assessment = await csraService.getCsraAssessment(user.username, prisonerNumber, assessmentId)
    if (!assessment || assessment.prisonerNumber !== prisonerNumber) {
      throw NotFound(`No CSRA assessment found for ID: ${assessmentId}`)
    }
    if (assessment.finalResult) {
      renderCsraAssessmentSubmitted(res, prisonerNumber)
      return
    }

    const provisionalAnswers = assessment.stages.find(stage => stage.stage === 'PROVISIONAL')
    if (!assessment.interimResult || !provisionalAnswers) {
      throw NotFound(`No provisional assessment found for ID: ${assessmentId}`)
    }

    const assessmentUrl = `/prisoner/${prisonerNumber}/csra/${assessmentId}`
    const finalAnswers = getAnswersFromAssessment(assessment)
    let selectedAnswer: string | undefined
    if (typeof finalAnswers.provisionalReviewed === 'boolean') {
      selectedAnswer = finalAnswers.provisionalReviewed ? 'YES' : 'NO'
    }
    let validationErrors: Record<string, { text: string }> | undefined

    if (req.method === 'POST') {
      const answer: unknown = req.body.provisionalReviewed
      if (answer === 'YES' || answer === 'NO') {
        await csraService.updateCsraAssessment(
          user.username,
          prisonerNumber,
          assessmentId,
          { ...finalAnswers, prisonId: prisoner.prisonId, provisionalReviewed: answer === 'YES' },
          'FINAL',
        )
        res.redirect(assessmentUrl)
        return
      }
      selectedAnswer = undefined
      validationErrors = {
        provisionalReviewed: { text: 'Select yes if you have reviewed the provisional assessment' },
      }
    }

    const rating = await csraService.getDetailedRating(user.username, assessmentId)
    if (rating.prisonerNumber !== prisonerNumber || rating.reviewId !== assessmentId) {
      throw NotFound(`No provisional assessment found for ID: ${assessmentId}`)
    }
    const completedBy = rating.provisionalCompletedBy
      ? (await manageUsersService.getUserDetails(user.username, rating.provisionalCompletedBy)).name
      : undefined

    await auditService.logPageView(Page.PRISONER_CSRA_REVIEW_PROVISIONAL, {
      who: user.username,
      subjectId: assessmentId,
      subjectType: 'ASSESSMENT_ID',
      correlationId: req.id,
    })

    res.render('pages/csraReviewProvisional', {
      prisoner,
      assessment,
      assessmentAnswers: provisionalAnswers,
      offenceEvidenceMap: getOffenceEvidenceMap(provisionalAnswers),
      flowConfig,
      rating,
      completedBy,
      remainingTasks: getRemainingTasks(provisionalAnswers),
      selectedAnswer,
      validationErrors,
      backLink: assessmentUrl,
      cancelLink: assessmentUrl,
    })
  }
}
