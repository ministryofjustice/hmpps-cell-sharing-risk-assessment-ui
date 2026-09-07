import { CsraAssessment } from '../../../data/csraApiTypes'
import YesNoQuestion from './yesNo'

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

describe('YesNoQuestion', () => {
  const question = new YesNoQuestion('Any evidence?', 'offenceMurderManslaughter')

  it('builds radio component attributes', () => {
    const result = question.componentAttributes(
      { offenceMurderManslaughter: { text: 'Select one' } },
      { offenceMurderManslaughter: 'YES' },
      makeAssessment(),
    ) as {
      items: Array<{ text: string; value: string }>
      errorMessage?: string
      value?: string
    }

    expect(result.items).toEqual([
      { text: 'Yes', value: 'YES' },
      { text: 'No', value: 'NO' },
    ])
    expect(result.value).toBe('YES')
    expect(result.errorMessage).toBe('Select one')
  })

  it('uses required validation', () => {
    const [validate] = question.validations()

    expect(validate(undefined)).toBe('TODO: select one')
    expect(validate('YES')).toBeNull()
  })

  it.each([
    ['YES for true', true, 'YES'],
    ['NO for false', false, 'NO'],
    ['undefined when unanswered', undefined, undefined],
  ])('%s', (_label: string, value: boolean | undefined, expected: string | undefined) => {
    expect(question.getFormValues(makeAssessment({ offenceMurderManslaughter: value as boolean }))).toEqual({
      offenceMurderManslaughter: expected,
    })
  })

  it('reports completion only when answered', () => {
    expect(question.isComplete(makeAssessment({ offenceMurderManslaughter: true }))).toBe(true)
    expect(question.isComplete(makeAssessment({ offenceMurderManslaughter: false }))).toBe(true)

    const unanswered = { ...makeAssessment(), offenceMurderManslaughter: undefined } as unknown as CsraAssessment
    expect(question.isComplete(unanswered)).toBe(false)
  })

  it('maps form values back into boolean assessment values', () => {
    expect(
      question.mutateAssessment(makeAssessment(), { offenceMurderManslaughter: 'YES' }).offenceMurderManslaughter,
    ).toBe(true)
    expect(
      question.mutateAssessment(makeAssessment(), { offenceMurderManslaughter: 'NO' }).offenceMurderManslaughter,
    ).toBe(false)
  })
})
