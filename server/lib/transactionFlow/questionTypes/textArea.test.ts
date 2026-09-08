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
    expect(result.errorMessage).toBe('Required')
  })

  it('uses required validation', () => {
    const [validate] = question.validations()

    expect(validate('')).toBe('TODO: enter a reason')
    expect(validate('details')).toBeNull()
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
})
