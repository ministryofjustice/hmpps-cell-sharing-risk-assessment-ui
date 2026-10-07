import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import TextAreaQuestion from './textArea'

const makeAssessment = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: 'MDI',
  offenceEvidence: [],
  likelyToHarmCellmate: false,
  riskTo: [],
  vulnerabilities: [],
  version: 1,
  ...overrides,
})

describe('TextAreaQuestion', () => {
  const question = new TextAreaQuestion('Provide details', 'likelyToHarmCellmateDetail')

  it('builds textarea component attributes', () => {
    const result = question.componentAttributes(
      { likelyToHarmCellmateDetail: { text: 'Required' } },
      { likelyToHarmCellmateDetail: 'Current value' },
      makeAssessment(),
    ) as { value?: string; errorMessage?: string }

    expect(result.value).toBe('Current value')
    expect(result.errorMessage).toEqual({ text: 'Required' })
  })

  it('uses required validation', () => {
    const [validate] = question.validations()

    expect(validate('')).toBe('There is a problem')
    expect(validate('details')).toBeNull()
  })

  it('uses a configured required validation message', () => {
    const configuredQuestion = new TextAreaQuestion('Provide details', 'likelyToHarmCellmateDetail', {
      validationMessages: { required: 'Enter details of the risk' },
    })
    const [validate] = configuredQuestion.validations()

    expect(validate('')).toBe('Enter details of the risk')
  })

  it('maps values between form and assessment', () => {
    expect(question.getFormValues(makeAssessment({ likelyToHarmCellmateDetail: 'A note' }))).toEqual({
      likelyToHarmCellmateDetail: 'A note',
    })

    const mutated = question.mutateAssessmentAnswers(makeAssessment(), {
      likelyToHarmCellmateDetail: 'Updated comment',
    })
    expect(mutated.likelyToHarmCellmateDetail).toBe('Updated comment')
  })

  it('is complete when a value exists', () => {
    expect(question.isAnswered(makeAssessment({ likelyToHarmCellmateDetail: 'Done' }))).toBe(true)
    expect(question.isAnswered(makeAssessment({ likelyToHarmCellmateDetail: '' }))).toBe(false)
  })

  it('clears only its own answer without mutating the original assessment', () => {
    const assessment = makeAssessment({
      likelyToHarmCellmateDetail: 'Recorded detail',
      significantlyVulnerableDetail: 'Unrelated detail',
    })
    const original = structuredClone(assessment)

    expect(question.eraseAnswers(assessment)).toEqual({ ...assessment, likelyToHarmCellmateDetail: null })
    expect(assessment).toEqual(original)
  })
})
