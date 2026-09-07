// eslint-disable-next-line max-classes-per-file
import { CsraAssessment } from '../../../data/csraApiTypes'
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

  override isComplete(): boolean {
    return true
  }

  override mutateAssessment(assessment: CsraAssessment): CsraAssessment {
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

  override isComplete(): boolean {
    return true
  }

  override mutateAssessment(assessment: CsraAssessment): CsraAssessment {
    return assessment
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
