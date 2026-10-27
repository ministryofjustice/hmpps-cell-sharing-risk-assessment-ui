import { CsraAssessment, CsraAssessmentStageAnswers } from '../../data/csraApiTypes'

export type AssessmentContext =
  | { phase: 'INITIAL'; answers: CsraAssessmentStageAnswers }
  | {
      phase: 'POST_PROVISIONAL'
      answers: CsraAssessmentStageAnswers
      provisionalAnswers: CsraAssessmentStageAnswers
    }

export default function getAssessmentContext(assessment: CsraAssessment): AssessmentContext {
  const provisionalAnswers = assessment.stages.find(stage => stage.stage === 'PROVISIONAL')
  if (assessment.interimResult) {
    if (!provisionalAnswers) {
      throw new Error('Submitted provisional assessment answers not found')
    }

    return {
      phase: 'POST_PROVISIONAL',
      provisionalAnswers,
      answers: assessment.stages.find(stage => stage.stage === 'FINAL') ?? {
        ...provisionalAnswers,
        stage: 'FINAL',
        version: 1,
      },
    }
  }

  return {
    phase: 'INITIAL',
    answers: provisionalAnswers ?? {
      prisonId: assessment.prisonId,
      stage: 'PROVISIONAL',
      offenceEvidence: [],
      riskTo: [],
      vulnerabilities: [],
      version: 1,
    },
  }
}
