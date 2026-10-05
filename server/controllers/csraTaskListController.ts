import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import flowConfig from '../lib/transactionFlow/config'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import { CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import config from '../config'
import { Page } from '../services/auditService'

type Dependencies = Pick<Services, 'auditService' | 'csraService' | 'warrantsService'>

/**
 * SectionStatus represents the status of a section in the CSRA assessment task list.
 * - 'LOCKED': The section is locked and cannot be accessed.
 * - 'NOT_STARTED': The section has not been started yet.
 * - 'IN_PROGRESS': The section is currently in progress.
 * - 'PROVISIONAL_COMPLETE': Every question in the section is answered, but some are not fully complete.
 * - 'COMPLETE': The section is fully complete.
 */
type SectionStatus = 'LOCKED' | 'NOT_STARTED' | 'IN_PROGRESS' | 'PROVISIONAL_COMPLETE' | 'COMPLETE'

function getSectionStatus(assessmentAnswers: CsraAssessmentStageAnswers, section: Section): SectionStatus {
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

function getSectionForTaskList(title: string, status: SectionStatus, href: string, hint?: string) {
  return {
    title,
    status,
    href: status !== 'LOCKED' ? href : undefined,
    hint,
  }
}

export default function csraTaskListController({
  auditService,
  csraService,
  warrantsService,
}: Dependencies): RequestHandler<{ prisonerNumber: string; assessmentId: string }> {
  return async (req, res, _next) => {
    const { assessmentId } = req.params
    const {
      prisoner,
      user: { username },
    } = res.locals

    const assessment = await csraService.getCsraAssessment(username, res.locals.prisoner.prisonerNumber, assessmentId)
    if (!assessment) {
      throw NotFound(`No CSRA assessment found for ID: ${assessmentId}`)
    }

    const assessmentAnswers = getAnswersFromAssessment(assessment)

    function assessmentSectionToTaskListSection(title: string, sectionId: string) {
      return getSectionForTaskList(
        title,
        getSectionStatus(assessmentAnswers, flowConfig[sectionId]),
        `/prisoner/${prisoner.prisonerNumber}/csra/${assessment.assessmentId}/section/${sectionId}`,
      )
    }

    const [
      evidenceAndOffencesSection,
      conversationAndVulnerabilitySection,
      observationSection,
      otherRisksSection,
      healthcareSection,
    ] = [
      assessmentSectionToTaskListSection('Evidence sources and offences', 'evidenceAndOffences'),
      assessmentSectionToTaskListSection('Prisoner conversation and vulnerability', 'conversationAndVulnerability'),
      assessmentSectionToTaskListSection('Officer observation', 'observation'),
      assessmentSectionToTaskListSection('Other risk factors', 'otherRisks'),
      assessmentSectionToTaskListSection('Healthcare assessment', 'healthcare'),
    ]

    // TODO: implement reviewProvisional section in flowConfig
    const taskLists = [
      ...(assessment.interimResult
        ? [
            {
              title: 'Provisional assessment',
              sections: [assessmentSectionToTaskListSection('Review provisional assessment', 'reviewProvisional')],
            },
          ]
        : []),
      {
        title: 'Operational assessment',
        sections: [
          evidenceAndOffencesSection,
          conversationAndVulnerabilitySection,
          observationSection,
          otherRisksSection,
        ],
      },
      {
        title: 'Healthcare assessment',
        sections: [healthcareSection],
      },
    ]

    const canSubmitFinalRating = taskLists.every(taskList =>
      taskList.sections.every(section => section.status === 'COMPLETE'),
    )

    const canSubmitProvisionalRating =
      ['COMPLETE', 'PROVISIONAL_COMPLETE'].includes(evidenceAndOffencesSection.status) &&
      ['COMPLETE', 'PROVISIONAL_COMPLETE'].includes(healthcareSection.status)

    taskLists.push({
      title: 'Rating',
      sections: [
        getSectionForTaskList(
          'Check answers and confirm rating',
          canSubmitFinalRating || (!assessment.interimResult && canSubmitProvisionalRating) ? 'IN_PROGRESS' : 'LOCKED',
          `/prisoner/${prisoner.prisonerNumber}/csra/${assessment.assessmentId}/confirm-rating`,
          assessment.interimResult ? 'You must complete all sections to enter a final rating.' : undefined,
        ),
      ],
    })

    await auditService.logPageView(Page.PRISONER_CSRA_TASK_LIST, {
      who: username,
      subjectId: assessmentId,
      subjectType: 'ASSESSMENT_ID',
      correlationId: req.id,
    })

    const { serviceUrls } = config

    // Court warrants are a proof of concept behind a flag (MAPA-349). hasRecentWarrants swallows its
    // own failures, so the evidence panel falls back to "no warrant information" and the task list
    // itself — the primary journey — is never held up by a downstream spike integration.
    const hasWarrants =
      config.warrants.enabled && (await warrantsService.hasRecentWarrants(username, prisoner.prisonerNumber))

    res.render('pages/csraTaskList', {
      prisoner,
      assessment,
      taskLists,
      serviceUrls,
      hasWarrants,
      warrantsUrl: `/prisoner/${prisoner.prisonerNumber}/csra/${assessment.assessmentId}/warrants`,
    })
  }
}
