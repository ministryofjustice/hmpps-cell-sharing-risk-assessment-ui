// eslint-disable-next-line max-classes-per-file
import { CsraAssessmentStageAnswers } from '../../../data/csraApiTypes'
import FeComponentsService from '../../../services/feComponentsService'
import Question from './base'
import CheckboxQuestion from './checkbox'

class ConditionalQuestion extends Question {
  override componentAttributes(): object {
    return { id: this.id }
  }

  override validations(): ValidationFunction[] {
    return []
  }

  override getFormValues(): FormValues {
    return { [this.id]: 'conditional value' }
  }

  override isAnswered(_assessment: CsraAssessmentStageAnswers): boolean {
    return true
  }

  override mutateAssessmentAnswers(assessment: CsraAssessmentStageAnswers): CsraAssessmentStageAnswers {
    return assessment
  }
}

class TestCheckboxQuestion extends CheckboxQuestion {
  constructor(items: CheckboxItem[]) {
    super('Choose items', 'evidenceSources', items)
  }

  override getFormValues(): FormValues {
    return { [this.id]: [] }
  }

  override isAnswered(_assessment: CsraAssessmentStageAnswers): boolean {
    return true
  }

  override mutateAssessmentAnswers(assessment: CsraAssessmentStageAnswers): CsraAssessmentStageAnswers {
    return assessment
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

describe('CheckboxQuestion', () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('builds component attributes and renders conditionals', () => {
    const conditional = new ConditionalQuestion('Other details', 'otherSource', 'govukInput')
    const question = new TestCheckboxQuestion([
      { text: 'Shown item', value: 'PNC' },
      {
        text: 'Conditional item',
        value: 'OTHER',
        conditional,
      },
      { text: 'Hidden item', value: 'DPS', removeIf: () => true },
    ])

    const componentSpy = jest.spyOn(FeComponentsService, 'getComponent').mockReturnValue('<input />')

    const result = question.componentAttributes(
      { evidenceSources: { text: 'Choose one' } },
      { evidenceSources: ['OTHER'] },
      makeAssessment(),
    ) as {
      items: Array<{ text: string; conditional?: { html: string } }>
      errorMessage?: string
      values: string[]
    }

    expect(result.items).toHaveLength(2)
    expect(result.items[0].text).toBe('Shown item')
    expect(result.items[1].conditional).toEqual({ html: '<input />' })
    expect(result.values).toEqual(['OTHER'])
    expect(result.errorMessage).toBe('Choose one')
    expect(componentSpy).toHaveBeenCalledWith('govukInput', { id: 'otherSource' })
  })

  it('uses required validation', () => {
    const question = new TestCheckboxQuestion([{ text: 'PNC', value: 'PNC' }])

    const [validate] = question.validations()

    expect(validate([])).toBe('At least 1 evidence source must be checked')
    expect(validate(['PNC'])).toBeNull()
  })
})
