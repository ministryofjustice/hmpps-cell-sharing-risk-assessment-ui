import { answeredQuestions, buildDpsReviewRows, buildLegacyReviewRows } from './csraReviewSummaryRows'
import type { CsraLegacyReviewDetail, CsraReviewDetail } from '../data/csraApiTypes'

const review = (overrides: Partial<CsraReviewDetail> = {}): CsraReviewDetail => ({
  id: 'de91dfa7-821f-4552-a427-bf2f32eafeb0',
  prisonerNumber: 'A1234BC',
  prisonId: 'LEI',
  prisonName: 'Leeds (HMP)',
  assessmentDate: '2016-10-31',
  type: 'REVIEW',
  createdAt: '2016-10-31T09:15:00',
  createdBy: 'NQP56Y',
  ...overrides,
})

const legacyReview = (legacy: Partial<CsraLegacyReviewDetail> = {}, overrides: Partial<CsraReviewDetail> = {}) =>
  review({ ...overrides, legacy: { questions: [], ...legacy } })

const labels = (rows: { key: { text: string } }[]) => rows.map(row => row.key.text)
const valueOf = (rows: { key: { text: string }; value: { text: string } }[], key: string) =>
  rows.find(row => row.key.text === key)?.value.text

describe('buildLegacyReviewRows', () => {
  it('shows the approval block first when a level was approved', () => {
    const rows = buildLegacyReviewRows(
      legacyReview({
        approvedResult: 'HI',
        approvalCommitteeComment: 'Agreed at review board.',
        approvalCommittee: { code: 'REVIEW', name: 'Review Board' },
        approvalDate: '2016-11-02',
      }),
    )

    expect(labels(rows).slice(0, 4)).toEqual(['Approved result', 'Approval comments', 'Approved by', 'Approval date'])
    expect(valueOf(rows, 'Approved result')).toBe('High')
    expect(valueOf(rows, 'Approval comments')).toBe('Agreed at review board.')
    expect(valueOf(rows, 'Approved by')).toBe('Review Board')
    expect(valueOf(rows, 'Approval date')).toBe('2 November 2016')
  })

  it('omits the whole approval block when nothing was approved', () => {
    const rows = buildLegacyReviewRows(legacyReview({ approvalDate: '2016-11-02' }))

    expect(labels(rows)).not.toContain('Approved result')
    expect(labels(rows)).not.toContain('Approval comments')
    expect(labels(rows)).not.toContain('Approved by')
    expect(labels(rows)).not.toContain('Approval date')
  })

  it('falls back to the legacy wording for each empty approval field', () => {
    const rows = buildLegacyReviewRows(legacyReview({ approvedResult: 'STANDARD' }))

    expect(valueOf(rows, 'Approval comments')).toBe('No approval comments entered')
    expect(valueOf(rows, 'Approved by')).toBe('Not entered')
    expect(valueOf(rows, 'Approval date')).toBe('Not entered')
  })

  it('always shows the assessment rows, with fallbacks', () => {
    const rows = buildLegacyReviewRows(legacyReview({}, { prisonName: null, prisonId: null }))

    expect(valueOf(rows, 'Assessment comments')).toBe('No assessment comment entered')
    expect(valueOf(rows, 'Calculated result')).toBe('Not entered')
    expect(valueOf(rows, 'Location')).toBe('Not entered')
    expect(valueOf(rows, 'Assessed by')).toBe('Not entered')
    expect(valueOf(rows, 'Next review date')).toBe('Not entered')
  })

  it('labels the raw NOMIS levels, which the CSRA result labels cannot', () => {
    const rows = buildLegacyReviewRows(legacyReview({ calculatedResult: 'LOW', approvedResult: 'MED' }))

    expect(valueOf(rows, 'Calculated result')).toBe('Low')
    expect(valueOf(rows, 'Approved result')).toBe('Medium')
  })

  it('falls back to the prison id when the name is unknown', () => {
    expect(valueOf(buildLegacyReviewRows(legacyReview({}, { prisonName: null })), 'Location')).toBe('LEI')
  })

  it('reports a rejected approval, which the legacy screens cannot distinguish', () => {
    expect(valueOf(buildLegacyReviewRows(legacyReview({ approvalStatus: 'NOT_APPROVED' })), 'Approval status')).toBe(
      'Not approved',
    )
    expect(labels(buildLegacyReviewRows(legacyReview({ approvalStatus: 'APPROVED' })))).not.toContain('Approval status')
    expect(labels(buildLegacyReviewRows(legacyReview()))).not.toContain('Approval status')
  })

  it('never offers override rows, which are not in the migration contract', () => {
    const rows = buildLegacyReviewRows(legacyReview({ approvedResult: 'HI' }))

    expect(labels(rows)).not.toContain('Override result')
    expect(labels(rows)).not.toContain('Override reason')
  })
})

describe('buildDpsReviewRows', () => {
  it('shows the review fields the API does return', () => {
    const rows = buildDpsReviewRows(
      review({
        type: 'CSRA_INITIAL_REVIEW',
        interimResult: 'STANDARD',
        interimResultDate: '2026-08-03',
        finalResult: 'HIGH_GENERAL',
        finalResultDate: '2026-08-04',
      }),
    )

    expect(valueOf(rows, 'Assessment date')).toBe('31 October 2016')
    expect(valueOf(rows, 'Type')).toBe('CSRA initial review')
    expect(valueOf(rows, 'Location')).toBe('Leeds (HMP)')
    expect(valueOf(rows, 'Provisional result')).toBe('Standard')
    expect(valueOf(rows, 'Provisional result date')).toBe('3 August 2026')
    expect(valueOf(rows, 'Final result')).toBe('High risk – general')
    expect(valueOf(rows, 'Final result date')).toBe('4 August 2026')
    expect(valueOf(rows, 'Started by')).toBe('NQP56Y')
    expect(valueOf(rows, 'Started')).toBe('31 October 2016 at 09:15')
  })

  it('omits a result block that has not been given yet', () => {
    const rows = buildDpsReviewRows(review({ type: 'CSRA_INITIAL_REVIEW' }))

    expect(labels(rows)).not.toContain('Provisional result')
    expect(labels(rows)).not.toContain('Final result')
  })

  it('only shows the last-updated rows once the review has been updated', () => {
    expect(labels(buildDpsReviewRows(review()))).not.toContain('Last updated')

    const rows = buildDpsReviewRows(review({ lastModifiedBy: 'ASMITH', lastModifiedAt: '2026-08-04T14:05:00' }))
    expect(valueOf(rows, 'Last updated by')).toBe('ASMITH')
    expect(valueOf(rows, 'Last updated')).toBe('4 August 2026 at 14:05')
  })
})

describe('answeredQuestions', () => {
  const question = (text: string, answer: string | null, additionalAnswers: string[] = []) => ({
    question: text,
    answer,
    additionalAnswers,
  })

  it('returns nothing when there are no questions', () => {
    expect(answeredQuestions([])).toEqual([])
    expect(answeredQuestions(undefined)).toEqual([])
  })

  it('drops questions that were not answered', () => {
    expect(answeredQuestions([question('Unanswered', null), question('Answered', 'Yes')])).toEqual([
      { question: 'Answered', answers: ['Yes'] },
    ])
  })

  it('keeps every answer to a question, unlike the legacy screen which shows only the first', () => {
    expect(answeredQuestions([question('Risk to', 'Different ethnicity', ['Transgender', 'Old people'])])).toEqual([
      { question: 'Risk to', answers: ['Different ethnicity', 'Transgender', 'Old people'] },
    ])
  })

  it('preserves the order the API supplied', () => {
    const questions = [question('First', 'a'), question('Second', 'b'), question('Third', 'c')]

    expect(answeredQuestions(questions).map(q => q.question)).toEqual(['First', 'Second', 'Third'])
  })
})
