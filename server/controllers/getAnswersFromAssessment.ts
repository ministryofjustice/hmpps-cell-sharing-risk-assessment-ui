import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'

export default function getAnswersFromAssessment(assessment: CsraAssessment): CsraAssessmentStageAnswers {
  if (assessment.interimResult) {
    const finalAnswers = assessment.stages.find(s => s.stage === 'FINAL')

    if (finalAnswers) {
      return finalAnswers
    }
  }

  return (
    assessment.stages.find(s => s.stage === 'PROVISIONAL') || {
      prisonId: assessment.prisonId,
      stage: 'PROVISIONAL',
      offenceEvidence: [],
      riskTo: [],
      vulnerabilities: [],
      version: 1,
    }
  )
}
