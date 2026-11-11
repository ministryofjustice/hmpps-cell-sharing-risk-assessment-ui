import { CsraAssessmentStageAnswers } from '../data/csraApiTypes'
import { getSectionStatus, TaskListSectionStatus } from './getTaskListSections'
import flowConfig from '../lib/transactionFlow/config'
import Step from '../lib/transactionFlow/step'
import YesNoQuestion from '../lib/transactionFlow/questionTypes/yesNo'

const makeStageAnswers = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'FINAL',
  prisonId: 'MDI',
  dpsChecked: true,
  perChecked: true,
  warrantChecked: true,
  pncChecked: true,
  offenceMurderManslaughter: false,
  offenceAssistingSuicide: false,
  offenceSexualAssault: false,
  offenceRepeatedViolence: false,
  offencePrejudiceMotivated: false,
  offenceArson: false,
  offenceKidnapHostage: false,
  offenceEvidence: [],
  riskTo: [],
  vulnerabilities: [],
  version: 1,
  ...overrides,
})

describe('getSectionStatus', () => {
  const section = flowConfig.evidenceAndOffences

  it.each<[boolean | null | undefined, TaskListSectionStatus]>([
    [false, 'IN_PROGRESS'],
    [true, 'COMPLETE'],
    [null, 'COMPLETE'],
    [undefined, 'COMPLETE'],
  ])('uses the review flag %s as an additional requirement', (offenceEvidenceReviewed, expected) => {
    const answers = makeStageAnswers({ offenceEvidenceReviewed })
    expect(section.steps.filter(s => !s.removeIf(answers)).every(s => s.isComplete(answers))).toBe(true)
    expect(getSectionStatus(answers, section)).toBe(expected)
  })

  it.each<[boolean | null | undefined, TaskListSectionStatus]>([
    [false, 'IN_PROGRESS'],
    [true, 'PROVISIONAL_COMPLETE'],
    [null, 'PROVISIONAL_COMPLETE'],
    [undefined, 'PROVISIONAL_COMPLETE'],
  ])('does not complete partially checked sources with review flag %s', (offenceEvidenceReviewed, expected) => {
    expect(getSectionStatus(makeStageAnswers({ pncChecked: false, offenceEvidenceReviewed }), section)).toBe(expected)
  })

  it.each([null, undefined])('requires an unanswered offence (%s) even when reviewed', offenceArson => {
    expect(getSectionStatus(makeStageAnswers({ offenceArson, offenceEvidenceReviewed: true }), section)).toBe(
      'IN_PROGRESS',
    )
  })

  it('requires conditional evidence even when reviewed', () => {
    expect(getSectionStatus(makeStageAnswers({ offenceArson: true, offenceEvidenceReviewed: true }), section)).toBe(
      'IN_PROGRESS',
    )
  })

  it('requires evidence details for a positive offence', () => {
    const answers = makeStageAnswers({
      offenceArson: true,
      offenceEvidenceReviewed: true,
      offenceEvidence: [{ offence: 'ARSON', sources: ['PNC'], details: '' }],
    })
    expect(getSectionStatus(answers, section)).toBe('IN_PROGRESS')
    answers.offenceEvidence[0].details = 'Evidence'
    expect(getSectionStatus(answers, section)).toBe('COMPLETE')
  })

  it('automatically checks a newly configured question without changing the completion rule', () => {
    const extendedSection: Section = {
      ...section,
      steps: [...section.steps, new Step({ questions: [new YesNoQuestion('New question', 'seenByHealthcare')] })],
    }
    const answers = makeStageAnswers({ offenceEvidenceReviewed: true })
    expect(getSectionStatus(answers, extendedSection)).toBe('IN_PROGRESS')
    expect(getSectionStatus({ ...answers, seenByHealthcare: false }, extendedSection)).toBe('COMPLETE')
  })

  it('preserves the unstarted status before any questions are answered', () => {
    expect(
      getSectionStatus(
        { stage: 'PROVISIONAL', prisonId: 'MDI', offenceEvidence: [], riskTo: [], vulnerabilities: [], version: 1 },
        section,
      ),
    ).toBe('NOT_STARTED')
  })
})
