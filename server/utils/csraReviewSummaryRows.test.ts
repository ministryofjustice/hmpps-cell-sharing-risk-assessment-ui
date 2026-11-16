import type { CsraAssessmentStageAnswers, CsraDetailedRating } from '../data/csraApiTypes'
import { createLegacyQuestionsRows, createSummaryRows } from './csraReviewSummaryRows'

describe('createSummaryRows', () => {
  const detailedRating: CsraDetailedRating = {
    prisonerNumber: 'A1234BC',
    status: 'COMPLETE',
    finalRating: 'HIGH_SPECIFIC',
    provisional: false,
    assessmentComment: 'Assessment note',
    nextReviewDate: '2026-09-10',
    finalCompletedBy: 'USER1',
    riskTo: [],
    vulnerabilities: [],
    stages: [],
  }

  it('creates rows from the current assessment stage', () => {
    const assessmentAnswers: CsraAssessmentStageAnswers = {
      stage: 'FINAL',
      prisonId: 'MDI',
      offenceEvidence: [],
      riskTo: [{ category: 'OTHER', details: 'Specific detail' }],
      vulnerabilities: [{ category: 'MENTAL_HEALTH', details: null }],
      version: 1,
    }

    expect(
      createSummaryRows({
        assessmentAnswers,
        detailedRating,
        userDisplayNames: new Map([['USER1', 'Jane Doe']]),
      }),
    ).toEqual([
      { key: { text: 'Rating' }, value: { text: 'High risk – specific' } },
      { key: { text: 'Risk to' }, value: { html: '<p>Other - Specific detail</p>' } },
      { key: { text: 'Vulnerable due to' }, value: { html: '<p>Mental health</p>' } },
      { key: { text: 'Assessment comment' }, value: { text: 'Assessment note' } },
      { key: { text: 'Next review due by' }, value: { text: 'Thursday 10 September 2026' } },
      { key: { text: 'Completed by' }, value: { text: 'Jane Doe' } },
    ])
  })

  it('escapes free-text details before including them in summary HTML', () => {
    const assessmentAnswers: CsraAssessmentStageAnswers = {
      stage: 'FINAL',
      prisonId: 'MDI',
      offenceEvidence: [],
      riskTo: [{ category: 'OTHER', details: '<img src=x onerror="alert(\'x\')"> & more' }],
      vulnerabilities: [{ category: 'OTHER', details: "<script>alert('x')</script>" }],
      version: 1,
    }

    const rows = createSummaryRows({
      assessmentAnswers,
      detailedRating,
      userDisplayNames: new Map(),
    })

    expect(rows.find(summaryRow => summaryRow.key.text === 'Risk to')?.value).toEqual({
      html: '<p>Other - &lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; more</p>',
    })
    expect(rows.find(summaryRow => summaryRow.key.text === 'Vulnerable due to')?.value).toEqual({
      html: '<p>Other - &lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;</p>',
    })
  })

  it('creates summary rows for a legacy rating', () => {
    const legacyRating: CsraDetailedRating = {
      ...detailedRating,
      prisonName: 'Moorland',
      nextReviewDate: null,
      startedBy: 'USER2',
      legacy: {
        level: 'HI',
        approvalStatus: 'APPROVED',
        calculatedResult: 'MED',
        overrideResult: null,
        approvedResult: 'HI',
        assessmentComment: 'Legacy assessment note',
        approvalCommitteeComment: 'Approval note',
        approvalComment: null,
        approvalDate: '2026-09-07',
        assessmentCommittee: { code: 'GOV', name: 'Assessment committee' },
        approvalCommittee: { code: 'MED', name: 'Approval committee' },
        nextReviewDate: null,
        questions: [],
      },
    }

    expect(
      createSummaryRows({
        detailedRating: legacyRating,
        userDisplayNames: new Map([['USER2', 'Jane Doe']]),
      }),
    ).toEqual([
      { key: { text: 'Approved result' }, value: { text: 'High' } },
      { key: { text: 'Approval comments' }, value: { text: 'Approval note' } },
      { key: { text: 'Approved by' }, value: { text: 'Approval committee' } },
      { key: { text: 'Approval date' }, value: { text: '7 September 2026' } },
      { key: { text: 'Assessment comments' }, value: { text: 'Legacy assessment note' } },
      { key: { text: 'Calculated result' }, value: { text: 'Medium' } },
      { key: { text: 'Location' }, value: { text: 'Moorland' } },
      {
        key: { text: 'Assessed by' },
        value: { text: 'Assessment committee - Jane Doe' },
      },
      { key: { text: 'Next review date' }, value: { text: 'Not entered' } },
    ])
  })

  it('formats legacy override levels and omits the unsupported override reason', () => {
    const legacyRating: CsraDetailedRating = {
      ...detailedRating,
      legacy: {
        level: 'HI',
        approvalStatus: 'APPROVED',
        calculatedResult: 'MED',
        overrideResult: 'LOW',
        approvedResult: null,
        assessmentComment: null,
        approvalCommitteeComment: null,
        approvalComment: null,
        approvalDate: null,
        assessmentCommittee: null,
        approvalCommittee: null,
        nextReviewDate: null,
        questions: [],
      },
    }

    const rows = createSummaryRows({
      detailedRating: legacyRating,
      userDisplayNames: new Map(),
    })

    expect(rows).toContainEqual({ key: { text: 'Approved result' }, value: { text: 'High' } })
    expect(rows).toContainEqual({ key: { text: 'Calculated result' }, value: { text: 'Medium' } })
    expect(rows).toContainEqual({ key: { text: 'Override result' }, value: { text: 'Low' } })
    expect(rows.map(summaryRow => summaryRow.key.text)).not.toContain('Override reason')
  })

  it('excludes system accounts from legacy assessor name lookups', () => {
    const legacyRating: CsraDetailedRating = {
      ...detailedRating,
      nextReviewDate: null,
      startedBy: 'SYS',
      legacy: {
        level: null,
        approvalStatus: 'NOT_APPROVED',
        calculatedResult: null,
        overrideResult: null,
        approvedResult: null,
        assessmentComment: null,
        approvalCommitteeComment: null,
        approvalComment: null,
        approvalDate: null,
        assessmentCommittee: null,
        approvalCommittee: null,
        nextReviewDate: null,
        questions: [],
      },
    }

    expect(
      createSummaryRows({
        detailedRating: legacyRating,
        userDisplayNames: new Map(),
      }),
    ).toEqual([
      { key: { text: 'Approval status' }, value: { text: 'Not approved' } },
      { key: { text: 'Assessment comments' }, value: { text: 'No assessment comment entered' } },
      { key: { text: 'Calculated result' }, value: { text: 'Not entered' } },
      { key: { text: 'Location' }, value: { text: 'Not entered' } },
      { key: { text: 'Assessed by' }, value: { text: 'Not entered' } },
      { key: { text: 'Next review date' }, value: { text: 'Not entered' } },
    ])
  })

  it('uses the values for the requested stage instead of falling back to provisional values', () => {
    const provisionalAnswers: CsraAssessmentStageAnswers = {
      stage: 'PROVISIONAL',
      prisonId: 'MDI',
      offenceEvidence: [],
      riskTo: [],
      vulnerabilities: [],
      version: 1,
    }
    const rating: CsraDetailedRating = {
      ...detailedRating,
      provisionalRating: 'HIGH_GENERAL',
      provisionalAssessmentComment: 'Provisional note',
      provisionalCompletedBy: 'USER2',
      assessmentComment: undefined,
      finalCompletedBy: undefined,
    }

    expect(
      createSummaryRows({
        assessmentAnswers: provisionalAnswers,
        detailedRating: rating,
        userDisplayNames: new Map([['USER2', 'Jane Doe']]),
      }),
    ).toEqual([
      { key: { text: 'Rating' }, value: { text: 'High risk – general (provisional)' } },
      { key: { text: 'Assessment comment' }, value: { text: 'Provisional note' } },
      { key: { text: 'Completed by' }, value: { text: 'Jane Doe' } },
    ])
    expect(
      createSummaryRows({
        detailedRating: rating,
        userDisplayNames: new Map(),
      }),
    ).toEqual([
      { key: { text: 'Rating' }, value: { text: 'High risk – specific' } },
      { key: { text: 'Assessment comment' }, value: { text: 'Not entered' } },
      { key: { text: 'Next review due by' }, value: { text: 'Thursday 10 September 2026' } },
      { key: { text: 'Completed by' }, value: { text: 'Unknown' } },
    ])
  })

  it('includes additional answers in legacy question rows and excludes unanswered questions and the completion marker', () => {
    expect(
      createLegacyQuestionsRows({
        questions: [
          { question: 'Is the assessment complete', answer: 'Yes', additionalAnswers: [] },
          { question: 'Question one', answer: 'No', additionalAnswers: ['Additional detail & <notes>'] },
          { question: 'Question two', answer: null, additionalAnswers: [] },
        ],
      }),
    ).toEqual([
      {
        key: { text: 'Question one' },
        value: { html: '<p>No</p><p>Additional detail &amp; &lt;notes&gt;</p>' },
      },
    ])
  })
})
