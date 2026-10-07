import { CsraAssessmentStageAnswers } from '../../data/csraApiTypes'
import Question from './questionTypes/base'
import YesNoWithDetailQuestion from './questionTypes/yesNoWithDetail'
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

  override isAnswered(_assessment: CsraAssessmentStageAnswers): boolean {
    return this.complete
  }

  override mutateAssessmentAnswers(assessment: CsraAssessmentStageAnswers): CsraAssessmentStageAnswers {
    return {
      ...assessment,
      likelyToHarmCellmateDetail: `${assessment.likelyToHarmCellmateDetail ?? ''}${this.nextField}`,
    }
  }

  override eraseAnswers(assessment: CsraAssessmentStageAnswers): CsraAssessmentStageAnswers {
    return { ...assessment, likelyToHarmCellmateDetail: null }
  }
}

const makeAssessment = (overrides: Partial<CsraAssessmentStageAnswers> = {}): CsraAssessmentStageAnswers => ({
  stage: 'PROVISIONAL',
  prisonId: 'MDI',
  offenceEvidence: [],
  riskTo: [],
  vulnerabilities: [],
  version: 1,
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

    const result = step.mutateAssessmentAnswers(makeAssessment(), {})

    expect(result.likelyToHarmCellmateDetail).toBe('AB')
  })

  it('merges form values from all questions', () => {
    const step = new Step({
      questions: [new TestQuestion('a', true, 'A', { one: '1' }), new TestQuestion('b', true, 'B', { two: '2' })],
    })

    expect(step.getFormValues(makeAssessment())).toEqual({ one: '1', two: '2' })
  })

  it('clears every question and its details without clearing the prerequisite or unrelated answers', () => {
    const step = new Step({
      questions: [
        new YesNoWithDetailQuestion('Likely to harm?', 'likelyToHarmCellmate', 'likelyToHarmCellmateDetail'),
        new YesNoWithDetailQuestion('Vulnerable?', 'significantlyVulnerable', 'significantlyVulnerableDetail'),
      ],
    }).dependsOn('officerSpokeToPrisoner', true)
    const assessment = makeAssessment({
      officerSpokeToPrisoner: false,
      likelyToHarmCellmate: true,
      likelyToHarmCellmateDetail: 'Risk detail',
      significantlyVulnerable: true,
      significantlyVulnerableDetail: 'Vulnerability detail',
      seenByHealthcare: true,
    })
    const original = structuredClone(assessment)

    expect(step.eraseAnswers(assessment)).toEqual({
      ...assessment,
      likelyToHarmCellmate: null,
      likelyToHarmCellmateDetail: null,
      significantlyVulnerable: null,
      significantlyVulnerableDetail: null,
    })
    expect(assessment).toEqual(original)
  })
})
