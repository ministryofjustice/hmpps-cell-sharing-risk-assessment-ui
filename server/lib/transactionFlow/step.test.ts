import { CsraAssessment } from '../../data/csraApiTypes'
import Question from './questionTypes/base'
import Step from './step'

class TestQuestion extends Question {
  constructor(
    id: string,
    private readonly complete: boolean,
    private readonly nextField: string,
    private readonly formValues: FormValues,
  ) {
    super(`Question ${id}`, id, 'testComponent')
  }

  override componentAttributes(): object {
    return {}
  }

  override validations(): ValidationFunction[] {
    return []
  }

  override getFormValues(): FormValues {
    return this.formValues
  }

  override isComplete(): boolean {
    return this.complete
  }

  override mutateAssessment(assessment: CsraAssessment): CsraAssessment {
    return { ...assessment, assessmentComment: `${assessment.assessmentComment}${this.nextField}` }
  }
}

const makeAssessment = (overrides: Partial<CsraAssessment> = {}): CsraAssessment => ({
  rating: 'STANDARD',
  prisonId: 'MDI',
  assessmentComment: '',
  dpsChecked: false,
  perChecked: false,
  warrantChecked: false,
  pncChecked: false,
  offenceMurderManslaughter: false,
  offenceAssistingSuicide: false,
  offenceSexualAssault: false,
  offenceRepeatedViolence: false,
  offencePrejudiceMotivated: false,
  offenceArson: false,
  offenceKidnapHostage: false,
  offenceEvidence: [],
  officerSpokeToPrisoner: false,
  likelyToHarmCellmate: false,
  significantlyVulnerable: false,
  causeForConcernSharing: false,
  otherHighRiskIndicators: false,
  seenByHealthcare: false,
  healthcareIncreasedRisk: false,
  riskTo: [],
  vulnerabilities: [],
  ...overrides,
})

describe('Step', () => {
  it('does not remove by default', () => {
    const step = new Step({ questions: [] })

    expect(step.removeIf(makeAssessment())).toBe(false)
  })

  it('is complete when all questions are complete', () => {
    const step = new Step({
      questions: [new TestQuestion('a', true, 'A', {}), new TestQuestion('b', true, 'B', {})],
    })

    expect(step.isComplete(makeAssessment())).toBe(true)
  })

  it('is incomplete when any question is incomplete', () => {
    const step = new Step({
      questions: [new TestQuestion('a', true, 'A', {}), new TestQuestion('b', false, 'B', {})],
    })

    expect(step.isComplete(makeAssessment())).toBe(false)
  })

  it('mutates assessment in question order', () => {
    const step = new Step({
      questions: [new TestQuestion('a', true, 'A', {}), new TestQuestion('b', true, 'B', {})],
    })

    const result = step.mutateAssessment(makeAssessment(), {})

    expect(result.assessmentComment).toBe('AB')
  })

  it('merges form values from all questions', () => {
    const step = new Step({
      questions: [new TestQuestion('a', true, 'A', { one: '1' }), new TestQuestion('b', true, 'B', { two: '2' })],
    })

    expect(step.getFormValues(makeAssessment())).toEqual({ one: '1', two: '2' })
  })
})
