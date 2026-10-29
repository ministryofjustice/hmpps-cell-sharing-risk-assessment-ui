import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'

export default function getAnswersFromAssessment(assessment: CsraAssessment): CsraAssessmentStageAnswers {
  const provisionalAnswers = assessment.stages.find(s => s.stage === 'PROVISIONAL')

  if (assessment.interimResult) {
    const finalAnswers = assessment.stages.find(s => s.stage === 'FINAL')

    if (finalAnswers) {
      return finalAnswers
    }

    // No FINAL stage yet: seed it from the PROVISIONAL answers as a new FINAL stage
    if (provisionalAnswers) {
      return { ...provisionalAnswers, stage: 'FINAL', version: 1 }
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
