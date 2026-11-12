import { CsraAssessment, CsraAssessmentStageAnswers, CsraDetailedRating } from '../data/csraApiTypes'
import flowConfig from '../lib/transactionFlow/config'

/** Get the answers from a specific stage of the assessment, or null if that stage is not present. */
export function getAnswersFromAssessmentStage(
  assessment: CsraAssessment | CsraDetailedRating,
  stage: 'PROVISIONAL' | 'FINAL',
): CsraAssessmentStageAnswers | null {
  return assessment.stages.find(s => s.stage === stage)
}

/** Get the answers from the assessment, preferring the final stage if present, otherwise the provisional stage. If neither is present, return a default provisional answer set. */
export default function getAnswersFromAssessment(assessment: CsraAssessment): CsraAssessmentStageAnswers {
  const provisionalAnswers = getAnswersFromAssessmentStage(assessment, 'PROVISIONAL')

  if (assessment.interimResult) {
    const finalAnswers = getAnswersFromAssessmentStage(assessment, 'FINAL')
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
