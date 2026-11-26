import { CsraAssessment, CsraAssessmentStageAnswers, CsraDetailedRating } from '../data/csraApiTypes'
import flowConfig from '../lib/transactionFlow/assessmentConfig'
import { getSectionStatus } from '../utils/getTaskListSections'

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

    if (provisionalAnswers) {
      if (getSectionStatus(provisionalAnswers, flowConfig.evidenceAndOffences) === 'COMPLETE') {
        return { ...provisionalAnswers, stage: 'FINAL', version: 1 }
      }

      // Incomplete evidence and offences must be saved again before the final stage is complete.
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
