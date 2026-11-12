import type { CsraAssessmentStageAnswers, CsraDetailedRating, CsraReviewQuestion } from '../data/csraApiTypes'
import { csraRiskToCategoryLabelMap, csraVulnerabilityCategoryLabelMap } from '../data/csraApiTypes'
import { csraLevelLabel, csraRatingLabel, formatDate, formatDayMonthYear } from './utils'

/** A row in a govukSummaryList. */
export interface SummaryRow {
  key: { text: string }
  value: { text: string } | { html: string }
}

/** A legacy question with every answer given to it, the first and any additional ones together. */
export interface AnsweredQuestion {
  question: string
  answers: string[]
}

const NOT_ENTERED = 'Not entered'

/** NOMIS accounts that stand for a process rather than a person, so they have no name to show. */
const SYSTEM_ACCOUNTS = ['SYS', 'XTAG']

/** The username to look a legacy assessor's name up with, or undefined where it is not a person. */
export const legacyAssessorUsername = (detailedRating: CsraDetailedRating): string | undefined =>
  detailedRating.legacy && !SYSTEM_ACCOUNTS.includes(detailedRating.startedBy) ? detailedRating.startedBy : undefined

/** Follows the profile page's "committee - name" format, without doubling up where neither is known. */
const assessedBy = (committee?: string, assessorName?: string): string =>
  committee || assessorName ? `${committee || NOT_ENTERED} - ${assessorName || NOT_ENTERED}` : NOT_ENTERED

const row = (key: string, value: string): SummaryRow => ({ key: { text: key }, value: { text: value } })

const htmlRow = (key: string, value: string): SummaryRow => ({ key: { text: key }, value: { html: value } })

/**
 * The first four populated summary rows for a migrated NOMIS review.
 *
 * Order and fallback wording follow the existing DPS prisoner profile page
 * (hmpps-prisoner-profile/server/mappers/csraReviewToSummaryListMapper.ts) so the two screens read the
 * same way while both exist.
 *
 * "Override result" and "Override reason" are on that page but deliberately absent here: NOMIS's
 * OVERRIDED_SUP_LEVEL_TYPE and its reason are not in the migration contract, so we never receive them.
 */
export const buildLegacyReviewRows = (
  detailedRating: CsraDetailedRating,
  userDisplayNames: Map<string, string>,
): SummaryRow[] => {
  const { legacy } = detailedRating
  const rows: SummaryRow[] = []

  // NOMIS shows the whole approval block or none of it, keyed off whether a level was approved at all.
  if (legacy?.approvalStatus === 'APPROVED') {
    rows.push(
      row('Approved result', csraLevelLabel(legacy.level)),
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

  const assessorUsername = legacyAssessorUsername(detailedRating)
  rows.push(
    row('Assessment comments', legacy.assessmentComment || 'No assessment comment entered'),
    row('Calculated result', csraLevelLabel(legacy.calculatedResult) || NOT_ENTERED),
  )

  if (legacy.overrideResult) {
    rows.push(row('Override result', legacy.overrideResult), row('Override reason', 'TODO'))
  }

  rows.push(
    row('Location', detailedRating.prisonName || detailedRating.prisonId || NOT_ENTERED),
    row(
      'Assessed by',
      assessedBy(legacy.assessmentCommittee?.name, userDisplayNames.get(assessorUsername) || assessorUsername),
    ),
    row('Next review date', formatDate(detailedRating.nextReviewDate) || NOT_ENTERED),
  )

  return rows
}

type SummaryRowsInput = {
  assessmentAnswers?: CsraAssessmentStageAnswers
  detailedRating: CsraDetailedRating
  userDisplayNames: Map<string, string>
}

export const createLegacyQuestionsRows = ({ questions }: { questions: CsraReviewQuestion[] }): SummaryRow[] =>
  questions.filter(q => q.question !== 'Is the assessment complete').map(q => row(q.question, q.answer || NOT_ENTERED))

/** The summary rows for a current assessment stage, or a migrated legacy review. */
export const createSummaryRows = ({
  assessmentAnswers,
  detailedRating,
  userDisplayNames,
}: SummaryRowsInput): SummaryRow[] => {
  if (detailedRating.legacy) {
    return buildLegacyReviewRows(detailedRating, userDisplayNames)
  }

  const isProvisional = assessmentAnswers?.stage === 'PROVISIONAL'
  const riskToHtml =
    assessmentAnswers?.riskTo
      ?.map(
        riskTo =>
          `<p>${csraRiskToCategoryLabelMap[riskTo.category]}${riskTo.details ? ` - ${riskTo.details}` : ''}</p>`,
      )
      .join('') ?? ''
  const vulnerabilitiesHtml =
    assessmentAnswers?.vulnerabilities
      ?.map(
        vulnerability =>
          `<p>${csraVulnerabilityCategoryLabelMap[vulnerability.category]}${vulnerability.details ? ` - ${vulnerability.details}` : ''}</p>`,
      )
      .join('') ?? ''
  const assessmentComment = isProvisional
    ? detailedRating.provisionalAssessmentComment
    : detailedRating.assessmentComment
  const completedBy = isProvisional ? detailedRating.provisionalCompletedBy : detailedRating.finalCompletedBy
  const rating = isProvisional ? detailedRating.provisionalRating : detailedRating.finalRating

  return [
    row('Rating', csraRatingLabel(rating, isProvisional ? 'PROVISIONAL' : null)),
    assessmentAnswers?.riskTo?.length ? htmlRow('Risk to', riskToHtml) : null,
    assessmentAnswers?.vulnerabilities?.length ? htmlRow('Vulnerable due to', vulnerabilitiesHtml) : null,
    row('Assessment comment', assessmentComment || NOT_ENTERED),
    !isProvisional && detailedRating.nextReviewDate
      ? row('Next review due by', formatDayMonthYear(detailedRating.nextReviewDate) || NOT_ENTERED)
      : null,
    row('Completed by', (completedBy && userDisplayNames.get(completedBy)) || 'Unknown'),
  ].filter((summaryRow): summaryRow is SummaryRow => summaryRow !== null)
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
