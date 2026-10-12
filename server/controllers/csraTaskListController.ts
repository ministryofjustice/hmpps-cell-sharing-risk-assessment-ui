import { type RequestHandler } from 'express'

import { NotFound } from 'http-errors'
import type { Services } from '../services'
import getAnswersFromAssessment from './getAnswersFromAssessment'
import config from '../config'
import { Page } from '../services/auditService'
import getTaskListSections, { getSectionForTaskList } from '../utils/getTaskListSections'
import { getAssessmentSubmitStatus } from '../utils/getAssessmentSubmitStatus'

type Dependencies = Pick<Services, 'auditService' | 'csraService' | 'warrantsService'>

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
    const {
      evidenceAndOffences,
      conversationAndVulnerability,
      observation,
      otherRisks,
      healthcare,
      reviewProvisional,
    } = getTaskListSections(assessment, assessmentAnswers, prisoner)

    // TODO: implement reviewProvisional section in flowConfig
    const taskLists = [
      ...(reviewProvisional
        ? [
            {
              title: 'Provisional assessment',
              sections: [reviewProvisional],
            },
          ]
        : []),
      {
        title: 'Operational assessment',
        sections: [evidenceAndOffences, conversationAndVulnerability, observation, otherRisks],
      },
      {
        title: 'Healthcare assessment',
        sections: [healthcare],
      },
    ]

    const submitStatus = getAssessmentSubmitStatus(assessment, assessmentAnswers, prisoner)

    taskLists.push({
      title: 'Rating',
      sections: [
        getSectionForTaskList(
          'Check answers and confirm rating',
          submitStatus.submitType === 'NONE' ? 'LOCKED' : 'IN_PROGRESS',
          `/prisoner/${prisoner.prisonerNumber}/csra/${assessment.assessmentId}/check-answers`,
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
