import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import flowConfig from '../lib/transactionFlow/config'

export default function getAnswersFromAssessment(assessment: CsraAssessment): CsraAssessmentStageAnswers {
  const provisionalAnswers = assessment.stages.find(s => s.stage === 'PROVISIONAL')

  if (assessment.interimResult) {
    const finalAnswers = assessment.stages.find(s => s.stage === 'FINAL')

    if (finalAnswers) {
      return finalAnswers
    }

    // Evidence and offences must be saved again before the final stage is complete.
    if (provisionalAnswers) {
      return flowConfig.evidenceAndOffences.steps.reduce<CsraAssessmentStageAnswers>(
        (answers, step) => step.eraseAnswers(answers),
        { ...provisionalAnswers, stage: 'FINAL', version: 1 },
      )
    }
  }

  return (
    provisionalAnswers || {
      prisonId: assessment.prisonId,
      stage: 'PROVISIONAL',
      offenceEvidence: [],
      riskTo: [],
      vulnerabilities: [],
      version: 1,
    }
  )
}
