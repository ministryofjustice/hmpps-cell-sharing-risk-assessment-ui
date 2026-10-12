import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import flowConfig from '../lib/transactionFlow/config'
import { Page } from '../services/auditService'
import { CsraAssessmentStageAnswers, OffenceType } from '../data/csraApiTypes'
import { AssessmentSubmitType, getAssessmentSubmitStatus } from '../utils/getAssessmentSubmitStatus'

type Dependencies = Pick<Services, 'auditService' | 'csraService'>

const offenceEvidenceTypeToQuestionKeyMap: Record<OffenceType, keyof CsraAssessmentStageAnswers> = {
  MURDER_MANSLAUGHTER: 'offenceMurderManslaughter',
  ASSISTING_SUICIDE: 'offenceAssistingSuicide',
  SEXUAL_ASSAULT: 'offenceSexualAssault',
  REPEATED_VIOLENCE: 'offenceRepeatedViolence',
  PREJUDICE_MOTIVATED: 'offencePrejudiceMotivated',
  ARSON: 'offenceArson',
  KIDNAP_HOSTAGE: 'offenceKidnapHostage',
}

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

    await auditService.logPageView(Page.PRISONER_CSRA_CONFIRM_RATING, {
      who: username,
      subjectId: assessmentId,
      subjectType: 'ASSESSMENT_ID',
      correlationId: req.id,
    })

    const offenceEvidenceMap = Object.fromEntries(
      assessmentAnswers.offenceEvidence.map(evidence => [
        offenceEvidenceTypeToQuestionKeyMap[evidence.offence],
        evidence,
      ]),
    )

    res.render('pages/csraCheckAnswers', {
      prisoner,
      assessment,
      assessmentAnswers,
      offenceEvidenceMap,
      submitType: submitStatus.submitType,
      remainingTasks: submitStatus.remainingTasks,
      flowConfig,
      backLink: assessmentUrl,
      cancelLink: assessmentUrl,
    })
  }
}
