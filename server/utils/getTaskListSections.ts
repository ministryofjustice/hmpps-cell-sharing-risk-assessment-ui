import flowConfig from '../lib/transactionFlow/config'
import { CsraAssessment, CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import { Prisoner } from '../data/prisonerSearchApiTypes'

/**
 * SectionStatus represents the status of a section in the CSRA assessment task list.
 * - 'LOCKED': The section is locked and cannot be accessed.
 * - 'NOT_STARTED': The section has not been started yet.
 * - 'IN_PROGRESS': The section is currently in progress.
 * - 'PROVISIONAL_COMPLETE': Every question in the section is answered, but some are not fully complete.
 * - 'COMPLETE': The section is fully complete.
 */
export type TaskListSectionStatus = 'LOCKED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'PROVISIONAL_COMPLETE' | 'COMPLETE'

export interface TaskListSection {
  title: string
  status: TaskListSectionStatus
  href?: string
  hint?: string
}

export interface TaskListSections {
  evidenceAndOffences: TaskListSection
  conversationAndVulnerability: TaskListSection
  observation: TaskListSection
  otherRisks: TaskListSection
  healthcare: TaskListSection
  reviewProvisional?: TaskListSection
}

function getSectionStatus(assessmentAnswers: CsraAssessmentStageAnswers, section: Section): TaskListSectionStatus {
  if (!section) {
    return 'LOCKED'
  }

  const steps = section.steps.filter(s => !s.removeIf(assessmentAnswers))

  if (steps.length === 0) {
    return 'LOCKED'
  }

  if (steps.every(s => s.isComplete(assessmentAnswers))) {
    return 'COMPLETE'
  }

  if (steps.every(s => s.isAnswered(assessmentAnswers))) {
    return 'PROVISIONAL_COMPLETE'
  }

  if (steps.some(s => s.isComplete(assessmentAnswers) || s.isAnswered(assessmentAnswers))) {
    return 'IN_PROGRESS'
  }

  return 'NOT_STARTED'
}

export function getSectionForTaskList(
  title: string,
  status: TaskListSectionStatus,
  href: string,
  hint?: string,
): TaskListSection {
  return {
    title,
    status,
    href: status !== 'LOCKED' ? href : undefined,
    hint,
  }
}

export default function getTaskListSections(
  assessment: CsraAssessment,
  assessmentAnswers: CsraAssessmentStageAnswers,
  prisoner: Prisoner,
): TaskListSections {
  function assessmentSectionToTaskListSection(sectionId: string, title: string) {
    return getSectionForTaskList(
      title,
      getSectionStatus(assessmentAnswers, flowConfig[sectionId]),
      `/prisoner/${prisoner.prisonerNumber}/csra/${assessment.assessmentId}/section/${sectionId}`,
    )
  }

  const sections: TaskListSections = {
    evidenceAndOffences: assessmentSectionToTaskListSection('evidenceAndOffences', 'Evidence sources and offences'),
    conversationAndVulnerability: assessmentSectionToTaskListSection(
      'conversationAndVulnerability',
      'Prisoner conversation and vulnerability',
    ),
    observation: assessmentSectionToTaskListSection('observation', 'Officer observation'),
    otherRisks: assessmentSectionToTaskListSection('otherRisks', 'Other risk factors'),
    healthcare: assessmentSectionToTaskListSection('healthcare', 'Healthcare assessment'),
  }

  if (assessment.interimResult) {
    sections.reviewProvisional = assessmentSectionToTaskListSection(
      'reviewProvisional',
      'Review provisional assessment',
    )
  }

  return sections
}
