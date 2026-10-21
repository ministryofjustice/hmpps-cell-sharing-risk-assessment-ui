import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import getTaskListSections from './getTaskListSections'
import { Prisoner } from '../data/prisonerSearchApiTypes'

function getRemainingTasks(assessmentAnswers: CsraAssessmentStageAnswers): string[] {
  const remainingTasks: string[] = []

  const uncheckedSources = []
  if (!assessmentAnswers.dpsChecked) {
    uncheckedSources.push('DPS')
  }
  if (!assessmentAnswers.perChecked) {
    uncheckedSources.push('PER')
  }
  if (!assessmentAnswers.pncChecked) {
    uncheckedSources.push('PNC')
  }
  if (!assessmentAnswers.warrantChecked) {
    uncheckedSources.push('Warrant')
  }

  if (uncheckedSources.length) {
    remainingTasks.push(`check remaining evidence sources (${uncheckedSources.join(', ')})`)
    remainingTasks.push('review offence questions after checking remaining evidence sources')
  }

  if (!assessmentAnswers.officerSpokeToPrisoner) {
    remainingTasks.push('speak to the prisoner about sharing a cell')
  } else if (
    assessmentAnswers.likelyToHarmCellmate === null ||
    assessmentAnswers.likelyToHarmCellmate === undefined ||
    (assessmentAnswers.likelyToHarmCellmate && !assessmentAnswers.likelyToHarmCellmateDetail)
  ) {
    remainingTasks.push('record if there is reason to believe the prisoner may harm someone they share a cell with')
  }

  if (assessmentAnswers.causeForConcernSharing !== false && !assessmentAnswers.causeForConcernSharingDetail) {
    remainingTasks.push('record any observations that cause a cell sharing concern')
  }

  if (assessmentAnswers.otherHighRiskIndicators !== false && !assessmentAnswers.otherHighRiskIndicatorsDetail) {
    remainingTasks.push('record any other indicators that suggest the prisoner is high risk')
  }

  if (!assessmentAnswers.seenByHealthcare) {
    remainingTasks.push('ensure the prisoner has been seen by healthcare')
  }

  return remainingTasks
}

export enum AssessmentSubmitType {
  NONE = 'NONE',
  PROVISIONAL = 'PROVISIONAL',
  FINAL = 'FINAL',
}

export function getAssessmentSubmitStatus(
  assessment: CsraAssessment,
  assessmentAnswers: CsraAssessmentStageAnswers,
  prisoner: Prisoner,
): {
  submitType: AssessmentSubmitType
  remainingTasks: string[]
  allowedRatings: string[]
} {
  if (assessment.finalResult) {
    return { submitType: AssessmentSubmitType.NONE, remainingTasks: [], allowedRatings: [] }
  }

  const sections = getTaskListSections(assessment, assessmentAnswers, prisoner)

  const canSubmitProvisionalRating =
    ['COMPLETE', 'PROVISIONAL_COMPLETE'].includes(sections.evidenceAndOffences.status) &&
    ['COMPLETE', 'PROVISIONAL_COMPLETE'].includes(sections.healthcare.status) &&
    !assessment.interimResult
  const canSubmitFinalRating = Object.values(sections).every(section => section.status === 'COMPLETE')
  if (!canSubmitProvisionalRating && !canSubmitFinalRating) {
    return { submitType: AssessmentSubmitType.NONE, remainingTasks: [], allowedRatings: [] }
  }

  const isHighGeneral = Boolean(
    assessmentAnswers.offenceMurderManslaughter ||
    assessmentAnswers.offenceAssistingSuicide ||
    assessmentAnswers.offenceSexualAssault,
  )

  let allowedRatings: string[]

  if (isHighGeneral) {
    allowedRatings = ['HIGH_GENERAL']
  } else if (!canSubmitFinalRating) {
    allowedRatings = ['HIGH_GENERAL', 'HIGH_SPECIFIC']
  } else {
    allowedRatings = ['HIGH_GENERAL', 'HIGH_SPECIFIC', 'STANDARD']
  }

  return {
    submitType: canSubmitFinalRating ? AssessmentSubmitType.FINAL : AssessmentSubmitType.PROVISIONAL,
    remainingTasks: getRemainingTasks(assessmentAnswers),
    allowedRatings,
  }
}
