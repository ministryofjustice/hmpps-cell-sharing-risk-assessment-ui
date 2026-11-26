import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import flowConfig from '../lib/transactionFlow/assessmentConfig'
import { CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import { eraseRemovedSteps, validateStep } from '../lib/transactionFlow/stepSubmission'
import { findNextAvailableStep, findNextUnansweredStep, findPreviousStep } from '../lib/transactionFlow/stepNavigation'
import { Page } from '../services/auditService'
import { appendReferrers, referrerStack } from '../utils/breadcrumbOrigins'
import InformationStep from '../lib/transactionFlow/informationStep'
import renderCsraAssessmentSubmitted from '../utils/renderCsraAssessmentSubmitted'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

function getCurrentStep(assessmentAnswers: CsraAssessmentStageAnswers, sectionId: string, stepId: number) {
  const section = flowConfig[sectionId]

  const firstUnansweredStep = findNextUnansweredStep(assessmentAnswers, section.steps)
  let currentStepId = stepId
  if (currentStepId === undefined || Number.isNaN(currentStepId)) {
    currentStepId = 0
  }

  if (firstUnansweredStep && firstUnansweredStep.stepId >= 0) {
    currentStepId = Math.min(currentStepId, firstUnansweredStep.stepId)
  }

  let currentStep = section.steps[currentStepId]
  if (!currentStep || currentStep.removeIf?.(assessmentAnswers)) {
    currentStep = firstUnansweredStep?.step
    currentStepId = firstUnansweredStep?.stepId
  }

  return { currentStep, currentStepId }
}

export default function csraQuestionController({ auditService, csraService }: Dependencies): RequestHandler<{
  prisonerNumber: string
  assessmentId: string
  sectionId: string
  stepId?: string
}> {
  return async (req, res, _next) => {
    const { assessmentId, sectionId } = req.params
    const {
      prisoner,
      user: { username },
    } = res.locals

    const section = flowConfig[sectionId]
    if (!section) {
      throw NotFound(`Invalid CSRA section: ${sectionId}`)
    }

    const assessment = await csraService.getCsraAssessment(username, res.locals.prisoner.prisonerNumber, assessmentId)
    if (!assessment) {
      throw NotFound(`No CSRA assessment found for ID: ${assessmentId}`)
    }

    if (assessment.finalResult) {
      renderCsraAssessmentSubmitted(res, prisoner.prisonerNumber)
      return
    }

    const assessmentAnswers = getAnswersFromAssessment(assessment)
    const questionContext = {
      provisionalRatingEntered: !!assessment.interimResult,
      assessmentAnswers,
      ...(assessment.interimResult
        ? { provisionalAnswers: assessment.stages.find(stage => stage.stage === 'PROVISIONAL') }
        : {}),
    }

    const { currentStep, currentStepId } = getCurrentStep(assessmentAnswers, sectionId, Number(req.params.stepId))

    if (!currentStep) {
      throw NotFound('Assessment step not found')
    }

    let values = Object.fromEntries(
      currentStep.questions.flatMap(question =>
        Object.entries(
          question.getFormValues(
            sectionId === 'evidenceAndOffences' &&
              questionContext.provisionalAnswers &&
              !question.isAnswered(assessmentAnswers)
              ? questionContext.provisionalAnswers
              : assessmentAnswers,
          ),
        ),
      ),
    )

    const referrers = referrerStack(req.query.referrer)
    const assessmentUrl = `/prisoner/${prisoner.prisonerNumber}/csra/${assessmentId}`
    const lastAnsweredStep = findPreviousStep(assessmentAnswers, section.steps, currentStepId, true)
    const backLink = lastAnsweredStep
      ? appendReferrers(`${assessmentUrl}/section/${sectionId}/${lastAnsweredStep.stepId}`, referrers)
      : appendReferrers(assessmentUrl, referrers)

    const continueStep =
      currentStep instanceof InformationStep
        ? findNextAvailableStep(assessmentAnswers, section.steps, currentStepId)
        : null
    const continueLink = appendReferrers(
      continueStep ? `${assessmentUrl}/section/${sectionId}/${continueStep.stepId}` : assessmentUrl,
      referrers,
    )

    let validationErrors: Record<string, { text: string }> = {}
    if (req.method === 'POST') {
      const {
        newValues,
        errors,
        values: submittedValues,
      } = validateStep(currentStep, req.body, values, questionContext)
      validationErrors = errors
      values = submittedValues

      if (Object.keys(validationErrors).length === 0) {
        let mutatedAssessmentAnswers = {
          ...currentStep.mutateAssessmentAnswers(assessmentAnswers, newValues, questionContext),
          version: assessmentAnswers.version || 0,
        }

        mutatedAssessmentAnswers = eraseRemovedSteps(section.steps.slice(currentStepId + 1), mutatedAssessmentAnswers)

        if (
          assessment.interimResult &&
          sectionId === 'evidenceAndOffences' &&
          !findNextAvailableStep(mutatedAssessmentAnswers, section.steps, currentStepId)
        ) {
          mutatedAssessmentAnswers.offenceEvidenceReviewed = true
        }

        const newAssessment = await csraService.updateCsraAssessment(
          username,
          res.locals.prisoner.prisonerNumber,
          assessmentId,
          mutatedAssessmentAnswers,
          assessment.interimResult ? 'FINAL' : 'PROVISIONAL',
        )

        const nextStep = findNextAvailableStep(getAnswersFromAssessment(newAssessment), section.steps, currentStepId)
        let nextStepUrl = assessmentUrl
        if (nextStep) {
          nextStepUrl += `/section/${sectionId}/${nextStep.stepId}`
        }
        res.redirect(appendReferrers(nextStepUrl, referrers))

        return
      }
    }

    await auditService.logPageView(Page.PRISONER_CSRA_QUESTION, {
      who: username,
      subjectId: assessmentId,
      subjectType: 'ASSESSMENT_ID',
      correlationId: req.id,
    })

    res.render(currentStep instanceof InformationStep ? 'pages/csraInformationStep' : 'pages/csraQuestion', {
      title: currentStep.title ?? section.title,
      saveButtonText: currentStepId < section.steps.length - 1 ? 'Save and continue' : 'Save and return',
      prisoner,
      section,
      currentStep,
      referrers,
      ...(Object.keys(validationErrors).length > 0 ? { validationErrors } : {}),
      values,
      assessmentAnswers,
      provisionalRatingEntered: questionContext.provisionalRatingEntered,
      questionContext,
      cancelLink: appendReferrers(assessmentUrl, referrers),
      backLink,
      continueLink,
    })
  }
}
