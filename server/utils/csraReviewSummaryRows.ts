import type { CsraReviewDetail, CsraReviewQuestion } from '../data/csraApiTypes'
import { csraLevelLabel, csraRatingLabel, csraTypeLabel, formatDate, formatDateTime } from './utils'

/** A row in a govukSummaryList. Values are always text, never html, so free text cannot inject markup. */
export interface SummaryRow {
  key: { text: string }
  value: { text: string }
}

/** A legacy question with every answer given to it, the first and any additional ones together. */
export interface AnsweredQuestion {
  question: string
  answers: string[]
}

const NOT_ENTERED = 'Not entered'

const row = (key: string, value: string): SummaryRow => ({ key: { text: key }, value: { text: value } })

/**
 * The summary rows for a migrated NOMIS review.
 *
 * Order and fallback wording follow the existing DPS prisoner profile page
 * (hmpps-prisoner-profile/server/mappers/csraReviewToSummaryListMapper.ts) so the two screens read the
 * same way while both exist.
 *
 * "Override result" and "Override reason" are on that page but deliberately absent here: NOMIS's
 * OVERRIDED_SUP_LEVEL_TYPE and its reason are not in the migration contract, so we never receive them.
 */
export const buildLegacyReviewRows = (detail: CsraReviewDetail): SummaryRow[] => {
  const legacy = detail.legacy!
  const rows: SummaryRow[] = []

  // NOMIS shows the whole approval block or none of it, keyed off whether a level was approved at all.
  if (legacy.approvedResult) {
    rows.push(
      row('Approved result', csraLevelLabel(legacy.approvedResult)),
      row('Approval comments', legacy.approvalCommitteeComment || 'No approval comments entered'),
      row('Approved by', legacy.approvalCommittee?.name || NOT_ENTERED),
      row('Approval date', formatDate(legacy.approvalDate) || NOT_ENTERED),
    )
  }

  // Not on the profile page, which has no way to tell "rejected at approval" from "never went to
  // approval". We do, and the two mean different things.
  if (legacy.approvalStatus === 'NOT_APPROVED') {
    rows.push(row('Approval status', 'Not approved'))
  }

  rows.push(
    row('Assessment comments', legacy.assessmentComment || 'No assessment comment entered'),
    row('Calculated result', csraLevelLabel(legacy.calculatedResult) || NOT_ENTERED),
    row('Type', csraTypeLabel(detail.type)),
    row('Location', detail.prisonName || detail.prisonId || NOT_ENTERED),
    row('Assessed by', legacy.assessmentCommittee?.name || NOT_ENTERED),
    row('Next review date', formatDate(legacy.nextReviewDate) || NOT_ENTERED),
  )

  return rows
}

/**
 * The summary rows for a review created in this service.
 *
 * Only the review's own fields: the answers captured during the assessment (evidence sources, offence
 * flags, the conversation and vulnerability questions, healthcare) are held per stage and are not
 * readable over the API yet, so the page says so rather than pretending they do not exist.
 */
export const buildDpsReviewRows = (detail: CsraReviewDetail): SummaryRow[] => {
  const rows: SummaryRow[] = [
    row('Assessment date', formatDate(detail.assessmentDate) || NOT_ENTERED),
    row('Type', csraTypeLabel(detail.type)),
    row('Location', detail.prisonName || detail.prisonId || NOT_ENTERED),
  ]

  if (detail.interimResult) {
    rows.push(
      row('Provisional result', csraRatingLabel(detail.interimResult)),
      row('Provisional result date', formatDate(detail.interimResultDate) || NOT_ENTERED),
    )
  }

  if (detail.finalResult) {
    rows.push(
      row('Final result', csraRatingLabel(detail.finalResult)),
      row('Final result date', formatDate(detail.finalResultDate) || NOT_ENTERED),
    )
  }

  rows.push(row('Started by', detail.createdBy), row('Started', formatDateTime(detail.createdAt) || NOT_ENTERED))

  if (detail.lastModifiedAt || detail.lastModifiedBy) {
    rows.push(
      row('Last updated by', detail.lastModifiedBy || NOT_ENTERED),
      row('Last updated', formatDateTime(detail.lastModifiedAt) || NOT_ENTERED),
    )
  }

  return rows
}

/**
 * The legacy questions that were actually answered, each with all of its answers.
 *
 * Unanswered questions are dropped, matching the profile page. Unlike that page we keep
 * additionalAnswers: the API takes care to filter null answers out before picking the first, so any
 * extra answers here are ones the assessor really gave.
 */
export const answeredQuestions = (questions: CsraReviewQuestion[] = []): AnsweredQuestion[] =>
  questions
    .filter(question => Boolean(question.answer))
    .map(question => ({
      question: question.question,
      answers: [question.answer, ...(question.additionalAnswers ?? [])].filter(Boolean),
    }))
